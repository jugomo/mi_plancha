package com.jugomo.miplancha.shared

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.jugomo.miplancha.waiter.LineStatus
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

data class OrderLine(
    val id: String,
    val amount: Int,
    val status: LineStatus,
    val productId: String,
    val tableNumber: Int,
    val orderId: String,
    val createdAt: Timestamp,
    val cookedAt: Timestamp?
) {}

fun DocumentSnapshot.toOrderLine(): OrderLine? {
    val amount = getLong("cantidad")?.toInt() ?:  return null
    val status = getString("estado")?.uppercase() ?: return null
    val parsedStt = LineStatus.entries.find { it.name == status } ?: return null
    val productId = getString("productoId") ?: return null
    val tableNumber = getLong("mesaNumero")?.toInt() ?: return null
    val orderId = reference.parent.parent?.id ?: return null
    val createdAt = getTimestamp("pedidoCreadoEn") ?: return null
    val cookedAt = getTimestamp("colocadoEn")

    return OrderLine(
        id = id ,
        amount = amount,
        status = parsedStt,
        productId = productId,
        tableNumber = tableNumber,
        orderId = orderId,
        createdAt = createdAt,
        cookedAt =  cookedAt
    )
}

fun startListeningAllLines(companyId: String): Flow<List<OrderLine>?> {
    return callbackFlow {
        val docRef = FirebaseFirestore.getInstance().collectionGroup("lineas")
            .whereEqualTo("empresaId", companyId)

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
