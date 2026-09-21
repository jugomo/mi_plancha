package com.jugomo.miplancha.waiter

import com.google.firebase.firestore.DocumentSnapshot

data class Mesa(
    var numero: Int,
    var estado: TableStatus,
    var clienteId: String?
) {
}

fun DocumentSnapshot.toMesa() : Mesa  = Mesa(
    numero = getLong("numero")?.toInt() ?: 0,
    estado = TableStatus.valueOf((getString("estado") ?: "").uppercase()),
    clienteId = getString("clienteId")
)

enum class TableStatus {
    LIBRE,
    OCUPADA
}