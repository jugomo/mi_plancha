package com.jugomo.miplancha.cook

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.shared.fetchProducts
import com.jugomo.miplancha.waiter.LineStatus
import kotlinx.coroutines.launch

@Composable
fun CookScreen(
    companyId: String,
    userId: String
) {
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableIntStateOf(0) }

    val service = remember { CookLinesService() }
    var lines by remember { mutableStateOf<List<OrderLine>>(emptyList()) }
    var overflowManualActive by remember { mutableStateOf(false) }
    var config by remember { mutableStateOf<CookConfig?>(null) }
    var products by remember { mutableStateOf<Map<String, ProductInfo>>(emptyMap()) }
    var showFullGrill by remember { mutableStateOf(false) }

    val effectiveCapacity: Int? = config?.grillCapacity?.let { base ->
        val pct = config?.overflowPercent
        if(overflowManualActive && pct != null) {
            (base * (1 + pct / 100.0)).toInt()
        } else {
            base
        }
    }

    LaunchedEffect(Unit) {
        service.startListeningLines(companyId).collect {
            if(it != null) {
                lines = it
            }
        }
    }

    LaunchedEffect(Unit) {
        service.startListeningOverflow(companyId).collect {
            overflowManualActive = it
        }
    }

    LaunchedEffect(Unit) {
        config = service.readConfig(companyId)
        products = fetchProducts(companyId)
    }

    Column {
        if(showFullGrill) {
            AlertDialog(
                onDismissRequest = { showFullGrill = false },
                confirmButton =  {
                    TextButton(
                        onClick = { showFullGrill = false }
                    ) {
                        Text("Aceptar")
                    }
                },
                title = { Text("Plancha llena") },
                text = { Text("La plancha está llena") }
            )
        }

        PrimaryTabRow(
            selectedTabIndex = selectedTab,
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 }
            ) {
                Text("Pedidos")
            }
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 }
            ) {
                Text("Plancha")
            }
        }

        when(selectedTab) {
            0 -> CookOrdersTab(
                lines,
                products,
                onTakeOrder = { orderLines ->
                    scope.launch {
                        val cfg = config ?: return@launch

                        try {
                            service.takeOrder(
                                companyId,
                                orderLines.first().orderId,
                                userId
                            )

                            orderLines.forEach { line ->
                                service.putInGrill(
                                    companyId = companyId,
                                    orderLine = line,
                                    products = products,
                                    config = cfg,
                                    overflowManualActive = overflowManualActive,
                                    allowOverflow = false
                                )
                            }
                        } catch (e: FullGrillException) {
                            showFullGrill = true
                        } catch (e: Exception) {
                            Log.e("CookScreen", e.toString())
                        }
                    }
                }
            )
            1 -> CookGrillTab(
                lines,
                products,
                onTakeFromGrill = { orderLines ->
                    scope.launch {
                        try {
                            orderLines.forEach { line ->
                                service.takeFromGrill(
                                    companyId,
                                    line
                                )
                            }
                        } catch (e: Exception) {
                            Log.e("CookScreen", e.toString())
                        }
                    }
                },
                capacity = effectiveCapacity
            )
        }

    }

}

@Composable
fun CookOrdersTab(
    lines: List<OrderLine>,
    products: Map<String, ProductInfo>,
    onTakeOrder : (List<OrderLine>) -> Unit
) {
    if(lines.isEmpty()) {
        Text("Sin pedidos")
        return
    }

    val cooking = lines.filter { it.status == LineStatus.EN_PLANCHA }
        .groupBy { it.orderId }
        .entries
        .sortedBy { it.value.minOf { l -> l.createdAt } }

    val pending = lines.filter { it.status == LineStatus.PENDIENTE }
        .groupBy { it.orderId }
        .entries
        .sortedBy { it.value.minOf { l -> l.createdAt } }

    LazyColumn(
        modifier = Modifier
            .padding(top = 24.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.primaryContainer)
            .padding(horizontal = 16.dp)
    ) {
        /* ORDERS BEING COOKED */
        item {
            Text(
                "En curso",
                fontWeight = FontWeight.Bold
            )
        }
        cooking.forEach { group ->
            item(key = "cooking-header-${group.key}") {
                Text("Mesa ${group.value.first().tableNumber}")
            }

            items(group.value, key = { it.id }) { line ->
                CookLineRow(line, products)
            }
        }


        /* ORDERS WAITING */
        item {
            Text(
                "Pendientes",
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .padding(top = 20.dp)
            )
        }
        pending.forEach { group ->
            item(key = "pending-header-${group.key}") {
                CookPendingHeader(
                    group.value.first().tableNumber,
                    onTakeOrder = {
                        onTakeOrder(group.value)
                    }
                )
            }

            items(group.value, key = {it.id}) { line ->
                CookLineRow(line, products)
            }
        }
    }
}

@Composable
fun CookLineRow(
    line: OrderLine,
    products: Map<String, ProductInfo>
) {
    Text("${line.amount}x ${products[line.productId]?.name ?: ""}")
}

@Composable
fun CookPendingHeader(
    tableNumber: Int,
    onTakeOrder: () -> Unit
) {
    Row {
        Text("Mesa ${tableNumber}")

        Spacer(Modifier.weight(1f))

        Button(
            onClick = { onTakeOrder() }
        ) {
            Text("Tomar pedido")
        }
    }
}

@Composable
fun CookGrillTab(
    lines: List<OrderLine>,
    products: Map<String, ProductInfo>,
    onTakeFromGrill: (List<OrderLine>) -> Unit,
    capacity: Int?
) {
    val cookingLines = lines.filter { it.status == LineStatus.EN_PLANCHA }
    val inUse = cookingLines.sumOf { line ->
        (products[line.productId]?.capacity ?: 0) * line.amount
    }
    val cooking = cookingLines
        .groupBy { it.orderId }
        .entries
        .sortedBy { it.value.minOf { l -> l.createdAt } }

    if(cooking.isEmpty()) {
        Text("Plancha vacía")
        return
    }

    LazyColumn(
        modifier = Modifier
            .padding(top = 24.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.primaryContainer)
            .padding(horizontal = 16.dp)
    ) {
        item {
            Column {
                if (capacity != null) {
                    LinearProgressIndicator(
                        progress = { inUse.toFloat() / capacity },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Row{
                    Text("Capacidad")
                    Spacer(Modifier.weight(1f))
                    Text("$inUse / ${capacity ?: 0}")
                }
            }
        }

        item {
            Text(
                "En plancha",
                fontWeight = FontWeight.Bold
            )
        }

        cooking.forEach { group ->
            item(key = "cooking-header-${group.key}") {
                CookGrillHeader(
                    tableNumber = group.value.first().tableNumber,
                    onTakeFromGrill = {
                        onTakeFromGrill(group.value)
                    }
                )
            }

            items(group.value, key = {it.id}) { line ->
                CookLineRow(line, products)
            }
        }
    }

}

@Composable
fun CookGrillHeader(
    tableNumber: Int,
    onTakeFromGrill: () -> Unit
) {
    Row() {
        Text("Mesa $tableNumber")

        Spacer(Modifier.weight(1f))

        Button(
            onClick = {
                onTakeFromGrill()
            }
        ) {
            Text("Retirar de plancha")
        }
    }
}