package com.jugomo.miplancha.shared

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot

data class CookOrder (
    var id: String,
    var tableNumber: Int,
    var clientName: String,
    var billId: String?,
    var createdAt: Timestamp?
)

fun DocumentSnapshot.toCookOrder(): CookOrder? {
    val tableNumber = getLong("mesaNumero")?.toInt() ?: return null
    val clientName = getString("clienteNombre") ?: return null
    val billId = getString("cuentaId")
    val timestamp = getTimestamp("creadoEn") ?: return null

    return CookOrder(id, tableNumber, clientName, billId, timestamp)
}
