package com.jugomo.miplancha

object UsernameEmail {

    fun normalize(valor: String) : String {
        return valor.lowercase().trim();
    }

    fun syntheticEmail(companyId: String, username: String): String {
        return "${normalize(username)}@${normalize(companyId)}.miplancha.local";
    }

}
