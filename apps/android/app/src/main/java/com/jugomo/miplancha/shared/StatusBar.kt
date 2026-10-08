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
import com.jugomo.miplancha.waiter.LineStatus

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