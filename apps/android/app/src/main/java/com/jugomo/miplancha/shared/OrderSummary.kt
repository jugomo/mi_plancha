package com.jugomo.miplancha.shared

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.jugomo.miplancha.waiter.LineStatus
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

data class OrderSummary (
    var id: String,
    var tableNumber: Int,
    var clientName: String,
    var billId: String?,
    var createdAt: Timestamp?
)

fun DocumentSnapshot.toOrderSummary(): OrderSummary? {
    val tableNumber = getLong("mesaNumero")?.toInt() ?: return null
    val clientName = getString("clienteNombre") ?: return null
    val billId = getString("cuentaId")
    val timestamp = getTimestamp("creadoEn") ?: return null

    return OrderSummary(id, tableNumber, clientName, billId, timestamp)
}

fun startListeningOrders(
    companyId: String,
    field: String,
    userId: String
) : Flow<List<OrderSummary>?> {
    return callbackFlow {
        val docRef = FirebaseFirestore.getInstance().collection("empresas")
            .document(companyId)
            .collection("pedidos")
            .whereEqualTo(field, userId)

        val listenerRegistration = docRef.addSnapshotListener { snapshot, error ->
            if(error != null) {
                close(error)
                return@addSnapshotListener
            }

            if(snapshot != null) {
                trySend(snapshot.documents.mapNotNull { it.toOrderSummary() })
            } else {
                trySend(null)
            }
        }

        awaitClose {
            listenerRegistration.remove()
        }
    }
}

fun completedOrders(
    orders: List<OrderSummary>,
    lines: List<OrderLine>
) : List<OrderSummary> {
    val filtered = lines.groupBy { it.orderId }
        .filter { it.value.all { l -> l.status == LineStatus.LISTO } }

    return orders.filter { it.id in filtered.keys }
}
