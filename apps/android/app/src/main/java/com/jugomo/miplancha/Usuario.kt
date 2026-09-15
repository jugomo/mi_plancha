package com.jugomo.miplancha

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
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

