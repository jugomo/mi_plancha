package com.jugomo.miplancha

import com.google.firebase.Timestamp

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