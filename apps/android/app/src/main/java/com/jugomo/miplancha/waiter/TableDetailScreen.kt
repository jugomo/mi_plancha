package com.jugomo.miplancha.waiter

import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.shared.fetchProducts
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun TableDetailScreen(
    tableId: String,
    companyId: String,
    waiterId: String
) {
    val scope = rememberCoroutineScope()

    val formatter = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val linesService = remember { LinesService() }
    val tablesService = remember { TablesService() }
    var table by remember { mutableStateOf<Table?>(null) }
    var lines by remember { mutableStateOf<List<OrderLine>>(emptyList()) }
    var products by remember { mutableStateOf<Map<String, ProductInfo>>(emptyMap()) }
    var grillCapacity by remember { mutableStateOf<Int?>(null) }
    var showOpenDialog by remember { mutableStateOf(false) }
    var showAddLine by remember { mutableStateOf(false) }
    var sendingOrder by remember { mutableStateOf(false) }
    var displayError by remember {mutableStateOf<String?>(null)}
    var client by remember { mutableStateOf<Client?>(null) }
    var showBillSheet by remember { mutableStateOf(false) }
    var billLines by remember { mutableStateOf<List<OrderLine>?>(null) }

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
        grillCapacity = linesService.getTotalCapacity(companyId)
    }

    LaunchedEffect(table?.clienteId) {
        val id = table?.clienteId

        if(id == null) {
            client = null
        } else {
            try {
                client = tablesService.getClient(
                    companyId,
                    id
                )
            } catch (e: Exception) {
                Log.e("TableDetailScreen", e.toString())
            }
        }
    }

    Box {
        if(table != null ) {
            if (showOpenDialog) {
                OpenTableDialog(
                    table!!.numero,
                    onConfirm = { name ->
                        scope.launch {
                            try {
                                tablesService.openTable(table!!, companyId, waiterId, name)
                            } catch (e: Exception) {
                                Log.e("TableDetailScreen", e.toString())
                                displayError = "Error al abrir mesa"
                            }
                        }
                        showOpenDialog = false
                    },
                    onDismiss = {
                        showOpenDialog = false
                    }
                )
            }

            if(showAddLine){
                AddLineSheet(
                    products = products,
                    grillCapacity = grillCapacity,
                    sending = sendingOrder,
                    onSend = { lines ->
                        if(!sendingOrder) {
                            sendingOrder = true

                            scope.launch {
                                try {
                                    linesService.addOrder(
                                        companyId = companyId,
                                        tableNumber =  table!!.numero,
                                        waiterId = waiterId,
                                        clientId = table!!.clienteId,
                                        clientName = client?.nombre,
                                        lines = lines
                                    )

                                    showAddLine = false
                                } catch (e: Exception) {
                                    Log.e("TableDetailScreen", e.toString())
                                    displayError = "Error al crear pedido"
                                } finally {
                                    sendingOrder = false
                                }
                            }
                        }
                    },
                    onDismiss = {
                        showAddLine = false
                    }
                )
            }

            if(showBillSheet) {
                BillSheet(
                    tableNumber = table!!.numero,
                    lines = billLines!!,
                    products = products,
                    onConfirm = {
                        TODO()
                    },
                    onDismiss = {
                        showBillSheet = false
                    }
                )
            }

            displayError?.let { message ->
                AlertDialog(
                    onDismissRequest = { displayError = null },
                    confirmButton = {
                        TextButton(
                            onClick = { displayError = null }
                        ) {
                            Text("Aceptar")
                        }
                    },
                    text = {
                        Text(message)
                    }
                )
            }

            Column {
                Text(
                    "Mesa ${table!!.numero}",
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold
                )

                client?.nombre?.let {
                    Text(it)
                }

                /* new order and collect payment buttons */
                if(table!!.estado == TableStatus.OCUPADA) {
                    Row() {
                        Button(
                            onClick = {
                                showAddLine = true
                            }
                        ){
                            Text("Nuevo pedido")
                        }

                        Button(
                            onClick = {
                                scope.launch {
                                    val tableNumber = table?.numero ?: return@launch
                                    val openedAt = client?.abiertoEn ?: return@launch

                                    try {
                                        billLines = linesService.fetchBillLines(
                                            companyId = companyId,
                                            tableNumber = tableNumber,
                                            openedAt = openedAt
                                        )

                                        showBillSheet = true
                                    } catch (e: Exception) {
                                        Log.e("TableDetailScreen", e.toString())
                                        displayError = "Error al cargar la cuenta"
                                    }
                                }
                            },
                            enabled = client != null
                        ) {
                            Text("Cobrar")
                        }
                    }
                }

                if(table!!.estado == TableStatus.LIBRE) {
                    Text("Mesa cerrada")
                    Button(
                        onClick = {
                            showOpenDialog = true
                        }
                    ){
                        Text("Abrir mesa")
                    }
                } else if(lines.isEmpty()) {
                        Text("Sin pedidos")
                } else {
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
                                            displayError = "Error al entregar pedido"
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
}