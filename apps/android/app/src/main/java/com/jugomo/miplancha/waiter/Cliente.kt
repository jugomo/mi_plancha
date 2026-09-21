package com.jugomo.miplancha.waiter

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot

data class Cliente(
    var mesaId: String,
    var nombre: String,
    var camareroId: String,
    var abiertoEn: Timestamp
) {
}

fun DocumentSnapshot.toCliente() : Cliente  = Cliente(
    mesaId = getString("mesaId") ?: "",
    nombre = getString("nombre") ?: "",
    camareroId = getString("camareroId") ?: "",
    abiertoEn = getTimestamp("abiertoEn") ?: Timestamp.now()
)
