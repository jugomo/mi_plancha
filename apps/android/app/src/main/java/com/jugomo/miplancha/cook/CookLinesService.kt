package com.jugomo.miplancha.cook

import androidx.compose.ui.text.toLowerCase
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.auth.toOrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.waiter.LineStatus
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class CookLinesService {
    private val db = FirebaseFirestore.getInstance()

    fun startListeningLines(companyId: String): Flow<List<OrderLine>?> {
        return callbackFlow {
            val docRef = db.collectionGroup("lineas")
                .whereEqualTo("empresaId", companyId)
                .whereIn(
                    "estado",
                    listOf(
                        LineStatus.PENDIENTE.name.lowercase(),
                        LineStatus.EN_PLANCHA.name.lowercase()
                    ) as List<Any?>
                )

            val listenerRegistration = docRef.addSnapshotListener { snapshot, error ->
                if(error != null) {
                    close(error)
                    return@addSnapshotListener
                }

                if(snapshot != null) {
                    trySend(snapshot.documents.mapNotNull { it.toOrderLine() })
                } else {
                    trySend(null)
                }
            }

            awaitClose {
                listenerRegistration.remove()
            }
        }
    }

    fun startListeningOverflow(companyId: String): Flow<Boolean> {
        return callbackFlow {
            val doc = db.collection("empresas").document(companyId)
                .collection("plancha").document("estado")

            val listenerRegistration = doc.addSnapshotListener { snapshot, exception ->
                if (exception != null) {
                    close(exception)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val overflow = snapshot.getBoolean("overflowManualActivo") ?: false
                    trySend(overflow)
                } else {
                    trySend(false)
                }
            }

            awaitClose {
                listenerRegistration.remove()
            }
        }
    }

    suspend fun readConfig(companyId: String): CookConfig {
        val snapGrill = db.collection("empresas").document(companyId)
            .collection("config").document("plancha").get().await()
        val grillCapacity = snapGrill.getLong("capacidadTotal")?.toInt()

        val snapDivision = db.collection("empresas").document(companyId)
            .collection("config").document("division").get().await()
        val thresoldDivision = snapDivision.getLong("umbral")?.toInt()
        val subgroupSize = snapDivision.getLong("tamanoSubgrupo")?.toInt()

        val snapInanicion = db.collection("empresas").document(companyId)
            .collection("config").document("antiInanicion").get().await()
        val maxWaitMinutes = snapInanicion.getLong("tiempoMaximoEsperaMin")?.toInt()

        val snapOverflow = db.collection("empresas").document(companyId)
            .collection("config").document("overflow").get().await()
        val overflowPercent = snapOverflow.getLong("porcentaje")?.toInt()

        return CookConfig(
            grillCapacity = grillCapacity,
            thresoldDivision = thresoldDivision ?: 8,
            subgroupSize = subgroupSize ?: 4,
            maxWaitSeconds =  (maxWaitMinutes ?: 15) * 60,
            overflowPercent = overflowPercent
        )
    }

    suspend fun takeOrder(companyId: String, orderId: String, userId: String) {
        val pedidoRef = db.collection("empresas").document(companyId)
            .collection("pedidos").document(orderId)

        db.runTransaction { trn ->
            val snap = trn.get(pedidoRef)

            if(snap.exists()) {
                val cocineroActual = snap.get("cocineroId")
                if (cocineroActual == null) {
                    trn.update(
                        pedidoRef,
                        mapOf(
                            "cocineroId" to userId
                        )
                    )
                } else if (cocineroActual != userId) {
                    throw Exception("Pedido ya tomado")
                }
            }

        }.await()
    }

    suspend fun putInGrill(
        companyId: String,
        orderLine: OrderLine,
        products: Map<String, ProductInfo>,
        config: CookConfig,
        overflowManualActive: Boolean,
        allowOverflow: Boolean
    ) {
        val lineRef = db.collection("empresas").document(companyId)
            .collection("pedidos").document(orderLine.orderId)
            .collection("lineas").document(orderLine.id)

        val cookingSnap = db.collectionGroup("lineas")
            .whereEqualTo("empresaId", companyId)
            .whereEqualTo("estado", LineStatus.EN_PLANCHA.name.lowercase())
            .get().await()

        val inUse = cookingSnap.documents.sumOf {
            val productId = it.getString("productoId") ?: ""
            val amount = it.getDouble("cantidad")?.toInt() ?: 0
            ((products[productId]?.capacity ?: 0) * amount)
        }

        val needed = (products[orderLine.productId]?.capacity ?: 0) * orderLine.amount
        val base = config.grillCapacity ?: return
        var capacity: Int
        val pct = config.overflowPercent
        if((overflowManualActive || allowOverflow) && pct != null) {
            capacity = (base * (1 + pct / 100.0)).toInt()
        } else {
            capacity = base
        }

        if((inUse + needed) > capacity) {
            throw FullGrillException()
        }
        val willUseOverflow = (inUse + needed) > base

        db.runTransaction { trn ->
            val productRef = db.collection("empresas").document(companyId)
                .collection("productos").document(orderLine.productId)

            val productSnap = trn.get(productRef)
            val stockActual = productSnap.getLong("stock")?.toInt() ?: 0
            if(stockActual < orderLine.amount) {
                throw Exception("Stock insuficiente")
            }

            trn.update(
                lineRef,
                buildMap<String, Any> {
                    put("estado", LineStatus.EN_PLANCHA.name.lowercase())
                    put("colocadoEn", FieldValue.serverTimestamp())
                    if(willUseOverflow) put("usandoOverflow", true)
                }
            )

            trn.update(
                productRef,
                mapOf(
                    "stock" to stockActual - orderLine.amount
                )
            )
        }.await()
    }

    suspend fun takeFromGrill(companyId: String, orderLine: OrderLine) {
        val ref = db.collection("empresas").document(companyId)
            .collection("pedidos").document(orderLine.orderId)
            .collection("lineas").document(orderLine.id)

        ref.update(
            mapOf(
                "estado" to LineStatus.PENDIENTE_ENTREGA.name.lowercase(),
                "retiradoEn" to FieldValue.serverTimestamp()
            )
        ).await()
    }

    suspend fun toggleOverflow(companyId: String, uid: String) {
        val ref = db.collection("empresas").document(companyId)
            .collection("plancha").document("estado")
        val snap = ref.get().await()
        val overflowManualActive = snap.getBoolean("overflowManualActivo") ?: false

        ref.set(
            mapOf(
                "overflowManualActivo" to !overflowManualActive,
                "activadoPor" to uid,
                "activadoEn" to FieldValue.serverTimestamp()
            ),
            SetOptions.merge()
        ).await()
    }
}

data class CookConfig (
    var grillCapacity: Int? = null,
    var thresoldDivision: Int,
    val subgroupSize: Int,
    var maxWaitSeconds: Int,
    var overflowPercent: Int? = null
)

class FullGrillException() : Exception("Full grill")
