package com.jugomo.miplancha.waiter

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.shared.fetchProducts

@Composable
fun TableDetailScreen(
    tableId: String,
    companyId: String
) {
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


                for (line in lines) {
                    Text("${line.amount}x ${products[line.productId]?.name ?: line.productId} - ${line.status.label}")
                }

            }
        }
    }
}