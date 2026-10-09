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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.ModalBottomSheet
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
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.shared.fetchProducts
import kotlinx.coroutines.launch

@Composable
fun WaiterScreen(
    companyId: String,
    waiterId: String,
    onTableCLick: (Table) -> Unit,
    modifier: Modifier = Modifier
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
                companyId,
                onTableCLick,
                modifier
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Content(tables : List<Table>,
            tablesService: TablesService,
            waiterId: String,
            companyId: String,
            onTableCLick: (Table) -> Unit,
            modifier: Modifier
) {
    val scope = rememberCoroutineScope()
    var tableParaAbrir by remember { mutableStateOf<Table?>(null) }
    var tableParaPedir by remember { mutableStateOf<Table?>(null) }
    var tableParaCobrar by remember { mutableStateOf<Table?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val linesService = remember { LinesService() }
    var billLines by remember { mutableStateOf<List<OrderLine>?>(null) }
    var products by remember {  mutableStateOf<Map<String, ProductInfo>>(emptyMap()) }
    var payingBill by remember { mutableStateOf(false) }

    LaunchedEffect(tableParaCobrar) {
        val mesa = tableParaCobrar
        if (mesa == null) {
            billLines = null
            return@LaunchedEffect
        }

        val clientId = mesa.clienteId ?: return@LaunchedEffect
        val client = tablesService.clientsCache[clientId] ?: return@LaunchedEffect

        try {
            products = fetchProducts(companyId)

            billLines = linesService.fetchBillLines(
                companyId = companyId,
                tableNumber = mesa.numero,
                openedAt = client.abiertoEn
            )
        } catch (e: Exception) {
            error = "Error al cargar la cuenta"
            tableParaCobrar = null
        }

    }

    Column(
        modifier.padding(16.dp),
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
                        } else {
                            tableParaPedir = mesa
                        }
                    }
                )
            }
        }
    }

    val mesa = tableParaAbrir
    if (mesa != null) {
        OpenTableDialog(
            mesa.numero,
            onConfirm = { clientName ->
                scope.launch {
                    try {
                        tablesService.openTable(mesa, companyId, waiterId, clientName)
                    } catch (e: MesaOcupadaError) {
                        error = e.message
                    }
                }
                tableParaAbrir = null
            },
            onDismiss = {
                tableParaAbrir = null
            }
        )
    }

    val mesaPedir = tableParaPedir
    if(mesaPedir != null) {
        ModalBottomSheet(onDismissRequest = {tableParaPedir = null}) {
            if (tablesService.tableOrderInfo[mesaPedir.numero]?.worstStatus ==
                LineStatus.PENDIENTE_ENTREGA) {
                TextButton(
                    onClick = {
                        scope.launch {
                            try {
                                tablesService.deliverAllPending(companyId, mesaPedir.numero)
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                        tableParaPedir = null
                    }
                ) {
                    Text("Entregar pedidos pendientes")
                }
            }
            TextButton(
                onClick = {
                    tableParaCobrar = mesaPedir
                    tableParaPedir = null
                }
            ) {
                Text("Cobrar")
            }

        }
    }

    val mesaCobrar = tableParaCobrar
    val lineasCuenta = billLines
    if(mesaCobrar != null && lineasCuenta != null) {
        BillSheet(
            tableNumber = mesaCobrar.numero,
            lines = lineasCuenta,
            products = products,
            payingBill = payingBill,
            onConfirm = {
                if(!payingBill) {
                    payingBill = true
                    scope.launch {
                        try {
                            val clientId = mesaCobrar.clienteId ?: return@launch
                            val client = tablesService.clientsCache[clientId] ?: return@launch

                            linesService.generateBill(
                                companyId = companyId,
                                tableId = mesaCobrar.id,
                                tableNumber = mesaCobrar.numero,
                                clientId = clientId,
                                clientName = client.nombre,
                                waiterId = waiterId,
                                billLines = lineasCuenta,
                                products = products
                            )
                            tableParaCobrar = null
                        } catch (e: ClientNotExists) {
                            error = "La mesa ya fue cobrada"
                        } catch(e: Exception) {
                            error = "Error al generar cuenta"
                        } finally {
                            payingBill = false
                        }
                    }
                }
            },
            onDismiss =  { tableParaCobrar = null}
        )
    }

    if (error != null) {
        AlertDialog(
            onDismissRequest = { error = null },
            title = { Text("Error   ") },
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