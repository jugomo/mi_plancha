package com.jugomo.miplancha.waiter

import android.graphics.Paint
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun TableCard(
    mesa: Mesa,
    orderStatus: LineStatus?,
    clientName: String?
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .height(200.dp)
            .border(
                width = 2.dp,
                color = Color.LightGray,
                shape = RoundedCornerShape(16.dp)
            )
            .let { modifier ->
                when(orderStatus) {

                }
                if(mesa.estado != TableStatus.LIBRE) {
                    modifier.background(Color.Green)
                } else {
                    modifier
                }
            },
    ) {
        Column() {
            Text(
                mesa.numero.toString(),
                textAlign = TextAlign.Center,
                color = Color.LightGray,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            if (mesa.estado == TableStatus.LIBRE) {
                Text(
                    "Libre",
                    fontSize = 10.sp,
                )
            }
            if (clientName != null && mesa.estado != TableStatus.LIBRE) {
                Text(clientName)
            }
            if(orderStatus != null) {
                Text(orderStatus.label)
            }
        }
    }
}