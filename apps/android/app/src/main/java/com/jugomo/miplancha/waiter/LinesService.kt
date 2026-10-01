package com.jugomo.miplancha.waiter

import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.auth.toOrderLine
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class LinesService {
    private val db = FirebaseFirestore.getInstance()
    private var companyId: String = ""

    fun startListeningTable(companyId: String, tableId: String): Flow<Table?> {
        this@LinesService.companyId = companyId

        return callbackFlow {
            val docRef = db.collection("empresas")
                .document(companyId)
                .collection("mesas")
                .document(tableId)

            val listenerRegistration = docRef.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }

                if(snapshot != null) {
                    trySend(snapshot.toTable())
                } else {
                    trySend(null)
                }

            }

            awaitClose {
                listenerRegistration.remove()
            }
        }
    }

    suspend fun getTotalCapacity(companyId: String): Int? {
        try {
            val snap = db.collection("empresas")
                .document(companyId)
                .collection("config")
                .document("plancha").get().await()

            return snap.getLong("capacidadTotal")?.toInt()
        } catch (e: Exception) {
            Log.e("LinesService", e.toString())
            return null
        }
    }

    fun startListeningLines(companyId: String, tableNumber: Int): Flow<List<OrderLine>?> {
        return callbackFlow {
            val docRef = db.collectionGroup("lineas")
                .whereEqualTo("mesaNumero", tableNumber)
                .whereEqualTo("empresaId", companyId)
                .whereNotEqualTo("estado", "listo")

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

    suspend fun markOrderDelivered(ordersLines: List<OrderLine>) {
        ordersLines.filter { it.status == LineStatus.PENDIENTE_ENTREGA }.forEach { line ->
                db.collection("empresas")
                    .document(companyId)
                    .collection("pedidos")
                    .document(line.orderId)
                    .collection("lineas")
                    .document(line.id)
                    .update(
                        mapOf(
                            "estado" to "listo",
                            "listoEn" to FieldValue.serverTimestamp()
                        )
                    ).await()
        }
    }

    suspend fun addOrder(
        companyId: String,
        tableNumber: Int,
        waiterId: String,
        clientId: String?,
        clientName: String?,
        lines: Map<String, Int>) {

        val pedidoRef = db.collection("empresas")
            .document(companyId)
            .collection("pedidos")
            .document()

        pedidoRef.set(
            mapOf(
                "mesaNumero" to tableNumber,
                "empresaId" to companyId,
                "camareroId" to waiterId,
                "cocineroId" to null,
                "cuentaId" to null,
                "creadoEn" to FieldValue.serverTimestamp(),
                "clienteId" to clientId,
                "clienteNombre" to clientName
            )
        ).await()

        for ((productId, amount) in lines) {
            pedidoRef.collection("lineas")
                .add(
                    mapOf(
                        "productoId" to productId,
                        "cantidad" to amount,
                        "estado" to LineStatus.PENDIENTE.name.lowercase(),
                        "subgrupo" to 1,
                        "usandoOverflow" to false,
                        "mesaNumero" to tableNumber,
                        "empresaId" to companyId,
                        "pedidoCreadoEn" to FieldValue.serverTimestamp()
                    )
                ).await()
        }
    }

    suspend fun fetchBillLines(
        companyId: String,
        tableNumber: Int,
        openedAt: Timestamp
    ) : List< OrderLine> {
        val snapshot = db.collectionGroup("lineas")
            .whereEqualTo("mesaNumero", tableNumber)
            .whereEqualTo("empresaId", companyId)
            .whereGreaterThanOrEqualTo("pedidoCreadoEn", openedAt)
            .get().await()

        return snapshot.documents.mapNotNull { it.toOrderLine() }
    }

}
