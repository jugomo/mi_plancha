package com.jugomo.miplancha.shared

import com.google.firebase.Timestamp

fun Timestamp.timeLapsed(nowMillis: Long): String {
    val segundos = (nowMillis - toDate().time) / 1000
    return when {
        segundos < 60 -> "${segundos}s"
        segundos < 3600 -> "${segundos / 60}min ${segundos % 60}s"
        else -> "${segundos / 3600}h ${(segundos % 3600) / 60}min"
    }
}