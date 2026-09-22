package com.jugomo.miplancha.waiter

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jugomo.miplancha.auth.Usuario
import com.jugomo.miplancha.shared.RoleContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

@Composable
fun WaiterScreen(
    companyId: String
) {

    // reactive states
    val tablesService = remember { TablesService() }
    var tables by remember { mutableStateOf<List<Mesa>?>(null) }
    var ordersByTable by remember { mutableStateOf<Map<Int, List<LineStatus>>?>(null) }

    // corroutine for listen tables
    LaunchedEffect(Unit) {
        val rs = tablesService.startListeningTables(companyId).collect { mesas ->
            tables = mesas
            Log.e("MESAS", "***MESAS*****************************")
            Log.e("MESAS", mesas.toString())

            mesas?.map { mesa ->
                if(mesa.clienteId != null) {
                    val client = tablesService.cacheClient( mesa)
                    Log.e("MESAS", "***CLIENTE: " + mesa.clienteId!! + "*****************************")
                    Log.e("CLIENTE", client.toString())
                    Log.e("CLIENTS", "*** CLIENTS " + tablesService.clientsCache.toString() + "************************")

                    if(mesa.estado == TableStatus.OCUPADA &&
                        tablesService.tableOrderInfo[mesa.numero] == null &&
                        tablesService.tablesAllDelivered[mesa.numero] == null ) {
                        tablesService.backfillDeliveredIfNeeded(
                            mesa.numero,
                            tablesService.clientsCache[mesa.clienteId]?.abiertoEn
                        )
                    }
                }

            }
        }


    }

    // corroutine for listen orders
    LaunchedEffect(Unit) {
        val rs = tablesService.startListeningOrdersByTable(companyId).collect { orders ->
            ordersByTable = orders
            Log.e("ORDERS", "--- ORDERS -----------------------------")
            Log.e("ORDERS", orders.toString())
        }
    }

    if (tables != null) {
        Content(tables!!,
                tablesService
        )
    }
}

@Composable
fun Content(mesas : List<Mesa>,
            tablesService: TablesService
) {
    val scope = rememberCoroutineScope()

    Column(
        Modifier.padding(16.dp),
    ) {
        Text(
            "Mesas",
            Modifier.padding(bottom = 16.dp),
            fontSize = 30.sp,                  // Define el tamaño grande (usa .sp)
            fontWeight = FontWeight.Bold
        )

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(mesas) { mesa ->
                val clName= tablesService.clientsCache.entries.firstOrNull {
                    it.value.mesaId == mesa.id
                }

                TableCard(
                    mesa = mesa,

                    orderSummary = tablesService.orderSummary(
                        mesa = mesa,
                        tableOrderInfo = tablesService.tableOrderInfo,
                        tablesAllDelivered = tablesService.tablesAllDelivered,
                        clientSatAt = tablesService.clientsCache[mesa.clienteId]?.abiertoEn,
                    ),
                    clientName = clName?.value?.nombre

                )
            }
        }
    }
}