package com.jugomo.miplancha.waiter

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.shared.StatusBar
import com.jugomo.miplancha.shared.fetchProducts
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun TableDetailScreen(
    tableId: String,
    companyId: String,
    waiterId: String,
    onBack: () -> Unit
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
    var payingBill by remember { mutableStateOf(false) }

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

    val onCollect: () -> Unit = {
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
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
                    }
                },
                title = {
                    Column (
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Mesa ${table?.numero ?: ""}")
                        client?.nombre?.let {
                            Text(it, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                },
                actions = {
                    if (table?.estado == TableStatus.OCUPADA) {
                        IconButton(onClick = { showAddLine = true }) {
                            Icon(Icons.Filled.Add, contentDescription = "Nuevo pedido")
                        }
                        IconButton(onClick = onCollect, enabled = client != null) {
                            Icon(Icons.Outlined.Payments, contentDescription = "Cobrar")
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier.padding(innerPadding)
        ) {
            if (table != null) {
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

                if (showAddLine) {
                    AddLineSheet(
                        products = products,
                        grillCapacity = grillCapacity,
                        sending = sendingOrder,
                        onSend = { lines ->
                            if (!sendingOrder) {
                                sendingOrder = true

                                scope.launch {
                                    try {
                                        linesService.addOrder(
                                            companyId = companyId,
                                            tableNumber = table!!.numero,
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

                if (showBillSheet && billLines != null) {
                    BillSheet(
                        tableNumber = table!!.numero,
                        lines = billLines!!,
                        products = products,
                        payingBill = payingBill,
                        onConfirm = {
                            if (!payingBill) {
                                payingBill = true

                                scope.launch {
                                    try {
                                        val table = table ?: return@launch
                                        val clientId = table.clienteId ?: return@launch
                                        val client = client ?: return@launch
                                        val billLines = billLines ?: return@launch

                                        linesService.generateBill(
                                            companyId = companyId,
                                            tableId = table.id,
                                            tableNumber = table.numero,
                                            clientId = clientId,
                                            clientName = client.nombre,
                                            waiterId = waiterId,
                                            billLines = billLines,
                                            products = products
                                        )

                                        showBillSheet = false
                                    } catch (e: ClientNotExists) {
                                        displayError = "La mesa ya fue cobrada"
                                    } catch (e: Exception) {
                                        Log.e("TableDetailScreen", e.toString())
                                        displayError = "Error al generar cuenta"
                                    } finally {
                                        payingBill = false
                                    }
                                }
                            }
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

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 24.dp, start = 16.dp, end = 16.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    if (table!!.estado == TableStatus.LIBRE) {
                        Text("Mesa cerrada")
                        Button(
                            onClick = {
                                showOpenDialog = true
                            }
                        ) {
                            Text("Abrir mesa")
                        }
                    } else if (lines.isEmpty()) {
                        Text("Sin pedidos")
                    } else {
                        for ((index, orderLines) in lines.groupBy { it.orderId }.values.sortedBy { it.first().createdAt }.withIndex()) {
                            Column {
                                Text(
                                    formatter.format(orderLines.first().createdAt.toDate()),
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.outlineVariant,
                                    modifier = Modifier.padding(top = if (index != 0) 12.dp else 0.dp)
                                )

                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme
                                            .colorScheme.surfaceContainerHigh
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 12.dp, vertical = 12.dp)
                                    ) {
                                        orderLines.forEachIndexed { index, line ->
                                            if (index > 0) {
                                                HorizontalDivider(
                                                    modifier = Modifier.padding(start = 17.dp,
                                                        top = 12.dp, bottom = 12.dp),
                                                    color = MaterialTheme.colorScheme.outlineVariant
                                                )
                                            }

                                            Row(
                                                modifier = Modifier.height(IntrinsicSize.Min),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                StatusBar(line.status)
                                                Spacer(Modifier.width(12.dp))
                                                Text(
                                                    "${line.amount}x",
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Spacer(Modifier.width(4.dp))
                                                Text(
                                                    products[line.productId]?.name ?: line.productId
                                                )
                                                Spacer(Modifier.weight(1f))
                                                Text(
                                                    line.status.label,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                        }

                                        if (orderLines.all { it.status == LineStatus.PENDIENTE_ENTREGA }) {
                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        try {
                                                            linesService.markOrderDelivered(
                                                                orderLines
                                                            )
                                                        } catch (e: Exception) {
                                                            Log.e("LinesService", e.toString())
                                                            displayError =
                                                                "Error al entregar pedido"
                                                        }
                                                    }
                                                }
                                            ) {
                                                Text("Entregar pedido")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}