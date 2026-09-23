package com.jugomo.miplancha.waiter

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
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
import kotlinx.coroutines.launch

@Composable
fun WaiterScreen(
    companyId: String,
    waiterId: String,
    onTableCLick: (Table) -> Unit
) {

    // reactive states
    val tablesService = remember { TablesService() }
    var tables by remember { mutableStateOf<List<Table>?>(null) }
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
                tablesService,
                waiterId,
                onTableCLick
        )
    }
}

@Composable
fun Content(tables : List<Table>,
            tablesService: TablesService,
            waiterId: String,
            onTableCLick: (Table) -> Unit
) {
    val scope = rememberCoroutineScope()
    var tableParaAbrir by remember { mutableStateOf<Table?>(null) }
    var nombreCliente by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier.padding(16.dp),
    ) {
        Text(
            "Mesas",
            Modifier.padding(bottom = 16.dp),
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold
        )

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(tables) { mesa ->
                val clName= tablesService.clientsCache.entries.firstOrNull {
                    it.value.mesaId == mesa.id
                }

                TableCard(
                    table = mesa,
                    orderSummary = tablesService.orderSummary(
                        table = mesa,
                        tableOrderInfo = tablesService.tableOrderInfo,
                        tablesAllDelivered = tablesService.tablesAllDelivered,
                        clientSatAt = tablesService.clientsCache[mesa.clienteId]?.abiertoEn,
                    ),
                    clientName = clName?.value?.nombre,
                    onCLick = {
                        onTableCLick(mesa)
                    },
                    onLongCLick = {
                        if(mesa.estado == TableStatus.LIBRE) {
                            tableParaAbrir = mesa
                        }
                    }
                )
            }
        }
    }

    val mesa = tableParaAbrir
    if (mesa != null) {
        AlertDialog(
            onDismissRequest = { tableParaAbrir = null; nombreCliente = "" },
            title = { Text("Abrir mesa ${mesa.numero}") },
            text = {
                TextField(
                    value = nombreCliente,
                    onValueChange = { nombreCliente = it },
                    label = { Text("Nombre del cliente") }
                )
            },
            confirmButton = {
                TextButton(
                    enabled = nombreCliente.isNotBlank(),
                    onClick = {
                        val nombre = nombreCliente
                        scope.launch {
                            try {
                                tablesService.openTable(mesa, waiterId, nombre)
                            } catch (e: MesaOcupadaError) {
                                error = e.message
                            }
                        }
                        tableParaAbrir = null
                        nombreCliente = ""
                    }
                ) { Text("Abrir") }
            },
            dismissButton = {
                TextButton(onClick = { tableParaAbrir = null; nombreCliente = "" }) {
                    Text("Cancelar")
                }
            }
        )
    }
    if (error != null) {
        AlertDialog(
            onDismissRequest = { error = null },
            title = { Text("Error al Abrir mesa") },
            text = {
                Text(error.toString())
            },
            confirmButton = {
                TextButton(onClick = { error = null }) {
                    Text("Cancelar")
                }
            }
        )
    }
}