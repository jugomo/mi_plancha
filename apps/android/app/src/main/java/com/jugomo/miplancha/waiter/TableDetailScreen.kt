package com.jugomo.miplancha.waiter

import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.shared.fetchProducts
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun TableDetailScreen(
    tableId: String,
    companyId: String
) {
    val scope = rememberCoroutineScope()

    val formatter = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val linesService = remember { LinesService() }
    var table by remember { mutableStateOf<Table?>(null) }
    var lines by remember { mutableStateOf<List<OrderLine>>(emptyList()) }
    var products by remember { mutableStateOf<Map<String, ProductInfo>>(emptyMap()) }

    LaunchedEffect(Unit) {
        linesService.startListeningTable(companyId, tableId).collect { gettable ->
            table = gettable
        }
    }

    LaunchedEffect(table?.numero) {
        if(table?.numero == null) {
            return@LaunchedEffect
        } else {
            linesService.startListeningLines(companyId, table!!.numero).collect { lineLst ->
                lines = lineLst ?: emptyList()
            }
        }
    }

    LaunchedEffect(Unit) {
        products = fetchProducts(companyId)
    }

    Box {
        if(table != null ) {

            Column {
                Text("numero: " + table!!.numero)
                Text("estado: " + table!!.estado)



                for ( orderLines in lines.groupBy { it.orderId }.values.sortedBy { it.first().createdAt }) {
                    Text(formatter.format(orderLines.first().createdAt.toDate()))
                    orderLines.forEach { line ->
                        Text("${line.amount}x ${products[line.productId]?.name ?: line.productId} - ${line.status.label}")
                    }

                    if(orderLines.all { it.status == LineStatus.PENDIENTE_ENTREGA }) {
                        Button(
                            onClick = {
                                scope.launch {
                                    try {
                                        linesService.markOrderDelivered(orderLines)
                                    } catch(e: Exception) {
                                        Log.e("LinesService", e.toString())
                                    }
                                }
                            }
                        ) {
                            Text("Entregar pedido")
                        }
                    }

                    Text("------")
                }

            }
        }
    }
}