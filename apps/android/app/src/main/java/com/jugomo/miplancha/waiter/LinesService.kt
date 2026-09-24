package com.jugomo.miplancha.waiter

import android.util.Log
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
}