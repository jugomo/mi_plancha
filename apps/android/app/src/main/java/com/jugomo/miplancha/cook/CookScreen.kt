package com.jugomo.miplancha.cook

import android.icu.text.CaseMap
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Report
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.firebase.Timestamp
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import com.jugomo.miplancha.shared.StatusBar
import com.jugomo.miplancha.shared.fetchProducts
import com.jugomo.miplancha.shared.formatDuration
import com.jugomo.miplancha.waiter.LineStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds

@Composable
fun CookScreen(
    companyId: String,
    userId: String,
    modifier: Modifier = Modifier
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

    var now by remember { mutableStateOf(Timestamp.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1_000.milliseconds)
            now = Timestamp.now()
        }
    }

    val cfg = config
    val suggestion: SuggestionResult? =
        if (cfg?.grillCapacity == null) null
        else computeSuggestion(
            pendingLines = lines.filter { it.status ==
                    LineStatus.PENDIENTE },
            cookingLines = lines.filter { it.status ==
                    LineStatus.EN_PLANCHA },
            products = products,
            grillCapacity = cfg.grillCapacity!!,
            overflowPercent = cfg.overflowPercent ?: 0,
            overflowManualActive = overflowManualActive,
            maxWaitSeconds = cfg.maxWaitSeconds,
            thresoldDivision = cfg.thresoldDivision,
            subgroupSize = cfg.subgroupSize,
            now = now
        )

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

    Column (
        modifier = modifier
    ) {
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
                lines = lines,
                products = products,
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
                suggestion = suggestion,
                capacity = effectiveCapacity,
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
                },
                onPlaceSuggestion = { suggestionLines ->
                    scope.launch {
                        val cfg = config ?: return@launch

                        try {
                            suggestionLines.map { it.orderId }.distinct().forEach { orderId ->
                                service.takeOrder(
                                    companyId,
                                    orderId,
                                    userId
                                )
                            }

                            suggestionLines.forEach { suggestionLine ->
                                val orderLine = lines.find { it.id == suggestionLine.id } ?: return@forEach

                                service.putInGrill(
                                    companyId = companyId,
                                    orderLine = orderLine,
                                    products = products,
                                    config = cfg,
                                    overflowManualActive = overflowManualActive,
                                    allowOverflow = suggestionLine.usingOverflow
                                )
                            }
                        } catch (e: FullGrillException) {
                            showFullGrill = true
                        } catch (e: Exception) {
                            Log.e("CookScreen", e.toString())
                        }
                    }
                },
                now = now,
                maxWaitSeconds = cfg?.maxWaitSeconds ?: 900
            )
            1 -> CookGrillTab(
                lines = lines,
                products = products,
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
                capacity = effectiveCapacity,
                overflowPercent = config?.overflowPercent,
                overflowManualActive = overflowManualActive,
                onToggleOverflow = {
                    scope.launch {
                        try {
                            service.toggleOverflow(companyId, userId)
                        } catch (e: Exception) {
                            Log.e("CookScreen", e.toString())
                        }
                    }
                },
                now = now
            )
        }

    }

}

@Composable
fun CookOrdersTab(
    lines: List<OrderLine>,
    products: Map<String, ProductInfo>,
    suggestion: SuggestionResult?,
    capacity: Int?,
    onTakeOrder : (List<OrderLine>) -> Unit,
    onPlaceSuggestion: (List<SuggestionLine>) -> Unit,
    now: Timestamp,
    onTakeFromGrill: (List<OrderLine>) -> Unit,
    maxWaitSeconds: Int
) {
    val cooking = lines.filter { it.status == LineStatus.EN_PLANCHA }
        .groupBy { it.orderId }
        .entries
        .sortedBy { it.value.minOf { l -> l.createdAt } }

    val pending = lines.filter { it.status == LineStatus.PENDIENTE }
        .groupBy { it.orderId }
        .entries
        .sortedBy { it.value.minOf { l -> l.createdAt } }

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp, start = 16.dp, end = 16.dp)
        ) {
            if (suggestion != null && capacity != null) {
                item(key = "suggestion") {
                    SuggestionCard(
                        result = suggestion,
                        capacity = capacity,
                        hasPending = pending.isNotEmpty(),
                        products = products,
                        onPlace = onPlaceSuggestion
                    )
                }
            }

            if (lines.isNotEmpty()) {
                /* ORDERS BEING COOKED */
                item {
                    SectionHeader("En curso")
                }
                cooking.forEach { group ->
                    item(key = "cooking-${group.key}") {
                        Card (
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            colors = CardDefaults.cardColors(
                                containerColor =
                                    MaterialTheme.colorScheme.surfaceContainerHigh
                            )
                        ) {
                            val allReady = group.value.all { line ->
                                val cookTime = products[line.productId]?.cookTimeSecs ?: 0
                                val start = line.cookedAt ?: line.createdAt
                                cookTime <= 0 || now.seconds >= start.seconds + cookTime
                            }
                            Column (
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(bottom = 20.dp)
                                ) {
                                    Text(
                                        "Mesa ${group.value.first().tableNumber}",
                                        fontWeight = FontWeight.Bold,
                                    )

                                    Spacer(Modifier.weight(1f))

                                    if (allReady) {
                                        SmallTonalButton(
                                            "Retirar de plancha",
                                            onClick = { onTakeFromGrill(group.value) },
                                        )
                                    }
                                }

                                group.value.forEachIndexed { index, line ->
                                    if(index > 0 ) {
                                        HorizontalDivider(
                                            modifier = Modifier.padding(start = 17.dp,
                                                top = 12.dp, bottom = 12.dp),
                                            color = MaterialTheme.colorScheme.outlineVariant
                                        )
                                    }
                                    CookLineRow(line, products, now)
                                }
                            }
                        }
                    }
                }


                /* ORDERS WAITING */
                item {
                    SectionHeader("Pendientes")
                }
                pending.forEach { group ->
                    item(key = "pending-${group.key}") {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            colors = CardDefaults.cardColors(
                                containerColor =
                                    MaterialTheme.colorScheme.surfaceContainerHigh
                            )
                        ) {
                            Column (
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                            ) {
                                CookPendingHeader(
                                    tableNumber = group.value.first().tableNumber,
                                    onTakeOrder = { onTakeOrder(group.value) },
                                    createdAt = group.value.minOf { it.createdAt },
                                    now = now,
                                    maxWaitSeconds =  maxWaitSeconds
                                )

                                group.value.forEachIndexed { index, line ->
                                    if(index > 0) {
                                        HorizontalDivider(
                                            modifier = Modifier.padding(start = 17.dp,
                                                top = 12.dp, bottom = 12.dp),
                                            color = MaterialTheme.colorScheme.outlineVariant
                                        )
                                    }
                                    CookLineRow(line, products, now)
                                }
                            }
                        }
                    }
                }
            }
        }

        if (lines.isEmpty()) {
           EmptyState("Sin pedidos", Modifier.align(Alignment.Center))
        }
    }
}

@Composable
fun CookLineRow(
    line: OrderLine,
    products: Map<String, ProductInfo>,
    now:  Timestamp
) {

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
        Text(products[line.productId]?.name ?: "")
        Spacer(Modifier.weight(1f))

        if(line.status == LineStatus.EN_PLANCHA) {
            val cooktime = products[line.productId]?.cookTimeSecs ?: 0
            val start = line.cookedAt ?: line.createdAt
            val remaining = start.seconds + cooktime - now.seconds
            if (cooktime > 0) {
                if(remaining <= 0) {
                    Text(
                        "Listo",
                        color = Color(0xFF2E7D32),
                        fontWeight = FontWeight.Bold
                    )
                } else {
                    Text(
                        "${line.status.label} · ${formatDuration(remaining)}",
                        color =  MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
fun CookPendingHeader(
    tableNumber: Int,
    onTakeOrder: () -> Unit,
    createdAt: Timestamp,
    now: Timestamp,
    maxWaitSeconds: Int
) {
    val waited = now.seconds - createdAt.seconds

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(bottom = 20.dp)
    ) {
        Text(
            "Mesa ${tableNumber}",
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.width(8.dp))
        Text(
            formatDuration(waited),
            color = if(waited >= maxWaitSeconds)
                        MaterialTheme.colorScheme.error
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelSmall,
        )
        Spacer(Modifier.weight(1f))
        SmallTonalButton(
            "Tomar pedido",
            onClick = { onTakeOrder() }
        )
    }
}

@Composable
fun CookGrillTab(
    lines: List<OrderLine>,
    products: Map<String, ProductInfo>,
    onTakeFromGrill: (List<OrderLine>) -> Unit,
    capacity: Int?,
    overflowPercent: Int?,
    overflowManualActive: Boolean,
    onToggleOverflow: () -> Unit,
    now:  Timestamp
) {
    val cookingLines = lines.filter { it.status == LineStatus.EN_PLANCHA }
    val inUse = cookingLines.sumOf { line ->
        (products[line.productId]?.capacity ?: 0) * line.amount
    }
    val cooking = cookingLines
        .groupBy { it.orderId }
        .entries
        .sortedBy { it.value.minOf { l -> l.createdAt } }

    Box (
        modifier = Modifier.fillMaxSize()
    ){
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp, start = 16.dp, end = 16.dp)
        ) {
            item {
                GrillCapacityCard(
                    inUse = inUse,
                    capacity = capacity,
                    overflowPercent = overflowPercent,
                    onToggleOverflow = onToggleOverflow,
                    overflowManualActive = overflowManualActive
                )
            }

            if (cooking.isNotEmpty()) {
                item {
                    SectionHeader("En plancha")
                }

                cooking.forEach { group ->
                    item(key = "cooking-${group.key}") {
                        Card (
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            colors = CardDefaults.cardColors(
                                containerColor =
                                    MaterialTheme.colorScheme.surfaceContainerHigh
                            )
                        ) {
                            Column(
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                            ) {
                                CookGrillHeader(
                                    tableNumber = group.value.first().tableNumber,
                                    onTakeFromGrill = {
                                        onTakeFromGrill(group.value)
                                    }
                                )

                                group.value.forEachIndexed { index, line ->
                                    if(index > 0){
                                        HorizontalDivider(
                                            modifier = Modifier.padding(start = 17.dp,
                                                top = 12.dp, bottom = 12.dp),
                                            color = MaterialTheme.colorScheme.outlineVariant
                                        )
                                    }
                                    CookLineRow(line, products, now)
                                }
                            }
                        }
                    }
                }
            }
        }

        if(cooking.isEmpty()) {
            EmptyState("Plancha vacía", Modifier.align(Alignment.Center))
        }
    }

}

@Composable
fun CookGrillHeader(
    tableNumber: Int,
    onTakeFromGrill: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(bottom = 20.dp)
    ) {
        Text(
            "Mesa $tableNumber",
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.weight(1f))

        SmallTonalButton(
            "Retirar de plancha",
            onClick = { onTakeFromGrill() }
        )
    }
}

@Composable
fun SuggestionCard(
    result: SuggestionResult,
    capacity: Int,
    hasPending: Boolean,
    products: Map<String, ProductInfo>,
    onPlace: (List<SuggestionLine>) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp, horizontal = 6.dp),
        colors = CardDefaults.cardColors(
            containerColor =
                MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.AutoAwesome,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Sugerencia d e plancha",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            if (result.lines.isEmpty() && result.alerts.isEmpty()) {
                Text(
                    if (hasPending) "La plancha está llena, no hay espacio para sugerir pedidos ahora"
                    else "No hay líneas pendientes que colocar",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                val byOrder = result.lines.groupBy { it.orderId }
                byOrder.forEach { (_, lines) ->
                    val tableNumber = lines.first().tableNumber
                    val isForced = lines.any { it.isForced }

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Mesa $tableNumber",
                            fontWeight = FontWeight.SemiBold
                        )
                        if (isForced) {
                            Spacer(Modifier.width(8.dp))
                            Icon(
                                imageVector = Icons.Outlined.WarningAmber,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Urgente",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }

                    lines.forEach { line ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("${line.amount}x ${products[line.productId]?.name ?: ""}")
                            if (line.usingOverflow) {
                                Icon(
                                    imageVector = Icons.Filled.LocalFireDepartment,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp),
                                    tint = Color(0xFFFF9800)
                                )
                            }
                        }
                    }
                }
                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row() {
                        Text("Capacidad tras colocar", style =
                            MaterialTheme.typography.bodySmall, color =
                            MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.weight(1f))
                        Text("${result.capacityAfter} / $capacity", style =
                            MaterialTheme.typography.bodySmall, color =
                            MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    LinearProgressIndicator(
                        progress = { result.capacityAfter.toFloat() / capacity.coerceAtLeast(1) },
                        modifier = Modifier.fillMaxWidth(),
                        trackColor = MaterialTheme.colorScheme.outlineVariant,
                        gapSize = 0.dp,
                        drawStopIndicator = {},
                        color = if (result.capacityAfter
                            > capacity
                        ) MaterialTheme.colorScheme.error else
                            MaterialTheme.colorScheme.primary
                    )
                }

                result.alerts.distinctBy { it.id }.forEach {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Report,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "Mesa ${it.tableNumber}: urgente, no cabe ni con overflow",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }

                if (result.lines.isNotEmpty()) {
                    Button(
                        onClick = { onPlace(result.lines) },
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text( "Colocar en plancha")
                    }
                }

            }
        }
    }
}

@Composable
fun GrillCapacityCard(
    inUse: Int,
    capacity: Int?,
    overflowPercent: Int?,
    onToggleOverflow: () -> Unit,
    overflowManualActive: Boolean
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp, horizontal = 6.dp),
        colors = CardDefaults.cardColors(
            containerColor =
                MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp, horizontal = 12.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Row {
                Text("Capacidad")
                Spacer(Modifier.weight(1f))
                Text("$inUse / ${capacity ?: 0}")
            }

            if (capacity != null) {
                LinearProgressIndicator(
                    progress = { inUse.toFloat() / capacity.coerceAtLeast(1) },
                    modifier = Modifier.fillMaxWidth(),
                    trackColor = MaterialTheme.colorScheme.outlineVariant,
                    gapSize = 0.dp,
                    drawStopIndicator = {}
                )
            }

            if (overflowPercent != null && overflowPercent > 0) {
                TextButton(
                    onClick = onToggleOverflow,
                    contentPadding = PaddingValues(0.dp)
                ) {
                    val color = if (overflowManualActive) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant

                    Icon(
                        imageVector = if (overflowManualActive) Icons.Filled.LocalFireDepartment
                        else Icons.Outlined.LocalFireDepartment,
                        contentDescription = null,
                        tint = color,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        if (overflowManualActive) "Overflow activo (+$overflowPercent)%"
                        else "Activar overflow (+$overflowPercent)%",
                        color = color
                    )
                }
            }
        }
    }
}

@Composable
fun EmptyState(
    message: String,
    modifier: Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Outlined.CheckCircle,
            contentDescription = null,
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(12.dp))
        Text(
            message,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 4.dp, top = 16.dp, bottom =
            4.dp)
    )
}

@Composable
fun SmallTonalButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilledTonalButton(
        onClick = onClick,
        modifier = modifier.height(32.dp),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp),
        colors = ButtonDefaults.filledTonalButtonColors(
            containerColor = MaterialTheme.colorScheme.primary.copy(alpha =
                0.15f),
            contentColor = MaterialTheme.colorScheme.primary
        )
    ) {
        Text(text, style = MaterialTheme.typography.labelMedium)
    }
}
