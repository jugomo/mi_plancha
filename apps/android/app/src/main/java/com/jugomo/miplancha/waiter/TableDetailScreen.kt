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

@Composable
fun TableDetailScreen(
    tableId: String,
    companyId: String
) {
    val linesService = remember { LinesService() }
    var table by remember { mutableStateOf<Table?>(null) }

    LaunchedEffect(Unit) {
        linesService.startListeningTable(companyId, tableId).collect { gettable ->
            table = gettable
        }
    }

    Box {
        if(table != null ) {

            Column {
                Text("numero: " + table!!.numero)
                Text("estado: " + table!!.estado)
            }
        }
    }
}