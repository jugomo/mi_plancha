package com.jugomo.miplancha

import com.google.firebase.firestore.DocumentSnapshot

data class Mesa(
    var numero: Int,
    var estado: String,
    var clienteId: String?
) {
}

fun DocumentSnapshot.toMesa() : Mesa  = Mesa(
    numero = getLong("numero")?.toInt() ?: 0,
    estado = getString("estado") ?: "",
    clienteId = getString("clienteId")
)
