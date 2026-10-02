package com.jugomo.miplancha.cook

import androidx.compose.ui.text.toLowerCase
import com.google.firebase.firestore.FirebaseFirestore
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.auth.toOrderLine
import com.jugomo.miplancha.waiter.LineStatus
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class CookLinesService {
    private val db = FirebaseFirestore.getInstance()
    private var companyId: String = ""

    fun startListeningLines(companyId: String): Flow<List<OrderLine>?> {
        this@CookLinesService.companyId = companyId

        return callbackFlow {
            val docRef = db.collectionGroup("lineas")
                .whereEqualTo("empresaId", companyId)
                .whereIn("estado",
                    listOf(LineStatus.PENDIENTE.name.lowercase(), LineStatus.EN_PLANCHA.name.lowercase()) as List<Any?>
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

    suspend private fun readConfig(companyId: String): CookConfig {
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
}

data class CookConfig (
    var grillCapacity: Int? = null,
    var thresoldDivision: Int,
    val subgroupSize: Int,
    var maxWaitSeconds: Int,
    var overflowPercent: Int? = null
)