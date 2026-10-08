package com.jugomo.miplancha.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.google.firebase.Timestamp
import com.jugomo.miplancha.waiter.LineStatus

fun Timestamp.timeLapsed(nowMillis: Long): String {
    val segundos = (nowMillis - toDate().time) / 1000
    return when {
        segundos < 60 -> "${segundos}s"
        segundos < 3600 -> "${segundos / 60}min ${segundos % 60}s"
        else -> "${segundos / 3600}h ${(segundos % 3600) / 60}min"
    }
}

fun formatDuration(totalSeconds: Long): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return if (minutes > 0) "$minutes min ${seconds} s" else "$seconds s"
}

@Composable
fun StatusBar(status: LineStatus) {
    Box(
        modifier = Modifier
            .width(5.dp)
            .fillMaxHeight()
            .clip(RoundedCornerShape(3.dp))
            .background(status.color)
    )
}
