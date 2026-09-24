package com.jugomo.miplancha.auth

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.jugomo.miplancha.waiter.LineStatus
import java.util.Locale.getDefault

data class Usuario(
    val uid: String,
    val nombre: String,
    val rol: Rol,
    val empresaId: String?,
    val email: String,
    val username: String?,
    val activo: Boolean = true,
    val creadoEn: Timestamp? = null
){

}

fun DocumentSnapshot.toUsuario(uid: String): Usuario = Usuario(
    uid = uid,
    nombre = getString("nombre") ?: "",
    rol = Rol.valueOf(getString("rol")?.uppercase(getDefault()) ?: ""),
    empresaId = getString("empresaId"),
    email = getString("email") ?: "",
    username = getString("username") ?: "",
    activo = getBoolean("activo") == true,
    creadoEn = getTimestamp("creadoEn")
)

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

    return OrderLine(
        id = id ,
        amount = amount,
        status = parsedStt,
        productId = productId,
        tableNumber = tableNumber,
        orderId = orderId,
        createdAt = createdAt,
        cookedAt =  null
    )
}
