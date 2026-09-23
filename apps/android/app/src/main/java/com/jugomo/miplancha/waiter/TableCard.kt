package com.jugomo.miplancha.waiter

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.Timestamp
import com.jugomo.miplancha.shared.timeLapsed
import kotlinx.coroutines.delay

@Composable
fun TableCard(
    table: Table,
    orderSummary: TableOrderSummary?,
    clientName: String?,
    onCLick: () -> Unit,
    onLongCLick: () -> Unit
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .combinedClickable(
                onClick = onCLick,
                onLongClick = onLongCLick
            )
            .clip(RoundedCornerShape(16.dp))
            .height(200.dp)
            .border(
                width = 2.dp,
                color = Color.LightGray,
                shape = RoundedCornerShape(16.dp)
            )
            .let { modifier ->
                when (orderSummary?.worstStatus) {
                    LineStatus.PENDIENTE_ENTREGA ->
                        modifier.background(Color(0xFFE65100).copy(alpha = 0.85f))
                    LineStatus.PENDIENTE ->
                        if (orderSummary.displayLabel != null)
                            modifier.background(Color(0xFFE65100).copy(alpha =
                                0.75f))
                        else
                            modifier.background(Color(0xFFE65100).copy(alpha =
                                0.35f))
                    LineStatus.EN_PLANCHA ->
                        modifier.background(Color(0xFFE65100).copy(alpha = 0.35f))
                    LineStatus.LISTO, null -> if (table.estado ==
                        TableStatus.OCUPADA) modifier.background(Color(0xFF2E7D32))
                    else modifier
                }
            },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                table.numero.toString(),
                textAlign = TextAlign.Center,
                color = if(table.estado == TableStatus.OCUPADA) Color.Black else Color.Gray,
                fontSize = 50.sp,
                fontWeight = FontWeight.Bold
            )
            if (table.estado == TableStatus.LIBRE) {
                Text(
                    "Libre",
                    fontSize = 10.sp,
                )
            }
            if (clientName != null && table.estado != TableStatus.LIBRE) {
                Text(clientName)
            }
            if(orderSummary?.displayLabel != null) {
                Text(orderSummary.displayLabel!!)
            } else {
                // TODO estados nosmales
                Text(orderSummary?.worstStatus?.label ?: "")

            }
            if(orderSummary?.lastUpdate != null) {
                TiempoTranscurrido(orderSummary.lastUpdate)
//                Text(orderSummary.lastUpdate.timeLapsed(Timestamp.now().seconds * 1000))
            }
        }
    }
}

@Composable
fun TiempoTranscurrido(desde: Timestamp) {
    var ahora by remember { mutableStateOf(System.currentTimeMillis()) }

    LaunchedEffect(desde) {
        while (true) {
            ahora = System.currentTimeMillis()
            delay(1000)
        }
    }
    Text(desde.timeLapsed(ahora))
}
