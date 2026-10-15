package com.jugomo.miplancha.cook

import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Task
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.jugomo.miplancha.shared.EmptyState
import com.jugomo.miplancha.shared.OrderLine
import com.jugomo.miplancha.shared.OrderSummary
import com.jugomo.miplancha.shared.SmallTonalButton
import com.jugomo.miplancha.shared.completedOrders
import com.jugomo.miplancha.shared.startListeningAllLines
import com.jugomo.miplancha.shared.startListeningOrders
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.material3.CircularProgressIndicator

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun CookCompletedScreen(
    companyId: String,
    userId: String,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val service = remember { CookLinesService() }
    var cookOrders by remember { mutableStateOf<List<OrderSummary>?>(null) }
    var allLines by remember { mutableStateOf< List<OrderLine>?>(null) }
    var toDelete by remember { mutableStateOf<OrderSummary?>(null) }

    LaunchedEffect(Unit) {
        try {
            startListeningOrders(companyId = companyId, field = "cocineroId",  userId = userId).collect {
                cookOrders = it
            }
        } catch (e: Exception) {
            Log.e("CookCompletedScreen", e.toString())
        }
    }

    LaunchedEffect(Unit) {
        try {
            startListeningAllLines( companyId).collect {
                allLines = it
            }
        } catch (e: Exception) {
            Log.e("CookCompletedScreen", e.toString())
        }
    }

    val completed = remember(cookOrders, allLines) {
        completedOrders(cookOrders ?: emptyList(), allLines ?: emptyList())
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver"
                        )
                    }
                },
                title = {
                    Text("Pedidos completados")
                },
            )
        }
    ) { innerPadding ->
        when {
            cookOrders == null || allLines == null ->
                Box(
                    modifier = Modifier.fillMaxSize()
                        .padding(innerPadding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }

            completed.isEmpty() ->
                EmptyState(
                    message = "Todavía no tienes pedidos completados",
                    icon = Icons.Outlined.Task,
                    description = "Actualmente no hay ningun pedido para mostrar",
                )

            else ->
                Box {
                    LazyColumn(
                        modifier = Modifier
                            .padding(top = 24.dp, bottom = 16.dp)
                            .padding(innerPadding)
                            .clip(RoundedCornerShape(12.dp))
                    ) {
                        items(completed) { order ->
                            Row {
                                Text("Mesa ${order.tableNumber} · ${order.clientName}")
                                if(order.billId != null) {
                                    SmallTonalButton(
                                        "Borrar",
                                        onClick = { toDelete  = order }
                                    )
                                }
                            }

                        }
                    }
                }
        }

        toDelete?.let { order ->
            AlertDialog(
                title = { Text("Confirma borrado") },
                text = { Text("¿Estás seguro de borrar el pedido de la mesa ${order.tableNumber}?")},
                onDismissRequest = { toDelete = null },
                confirmButton = {
                    SmallTonalButton(
                        "Borrar",
                        onClick = {
                            toDelete = null

                            scope.launch {
                                try {
                                    service.deleteCompletedOrder(companyId, order.id)
                                } catch (e: Exception) {
                                    Log.e("CookCompletedScreen", e.toString())
                                }
                            }

                        }
                    )
                },
                dismissButton = {
                    SmallTonalButton(
                        "Cancelar",
                        onClick = { toDelete = null }
                    )
                }
            )
        }
    }
}