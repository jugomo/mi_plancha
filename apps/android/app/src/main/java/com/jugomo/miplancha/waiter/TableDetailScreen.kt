package com.jugomo.miplancha.waiter

import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
    var sendOrderError by remember {mutableStateOf<String?>(null)}
    var clientName by remember { mutableStateOf<String?>(null) }

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
            clientName = null
        } else {
            try {
                clientName = tablesService.getClient(
                    companyId,
                    id
                )?.nombre
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
                            } catch (e: MesaOcupadaError) {
                                Log.e("TableDetailScreen", "la mesa ya estaba abierta: $e")
                            } catch (e: Exception) {
                                Log.e("TableDetailScreen", e.toString())
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
                                        clientName = clientName,
                                        lines = lines
                                    )

                                    showAddLine = false
                                } catch (e: Exception) {
                                    Log.e("TableDetailScreen", e.toString())
                                    sendOrderError = "Error al crear pedido"
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

            sendOrderError?.let { message ->
                AlertDialog(
                    onDismissRequest = { sendOrderError = null },
                    confirmButton = {
                        TextButton(
                            onClick = { sendOrderError = null }
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

                clientName?.let {
                    Text(it)
                }

                if(table!!.estado == TableStatus.OCUPADA) {
                    Button(
                        onClick = {
                            showAddLine = true
                        }
                    ){
                        Text("Nuevo pedido")
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