package com.jugomo.miplancha.waiter

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillSheet(
    tableNumber: Int,
    lines: List<OrderLine>,
    products: Map<String, ProductInfo>,
    onConfirm: () -> Unit,
    onDismiss: () ->Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(
            Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.padding(bottom = 12.dp)
            ) {
                Button(
                    onClick = { onDismiss() }
                ) { Text("Cancelar") }

                Spacer(Modifier.weight(1f))

                Button(
                    onClick = {onConfirm()}
                ) { Text("Cobrar y cerrar") }
            }

            Text(
                "Cuenta mesa $tableNumber",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )

            LazyColumn(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .padding(top = 24.dp, bottom = 16.dp)
                    .clip(RoundedCornerShape(12.dp))
            ) {
                items(lines) { line ->
                    Row(
                        modifier = Modifier
                            .background(MaterialTheme.colorScheme.primaryContainer)
                            .padding(16.dp)
                    ) {
                        Text(products[line.productId]?.name ?: line.productId)

                        Spacer(Modifier.weight(1f))

                        Text(
                            "${line.amount}x ",
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.3f)
                        )
                        Text(String.format("%.2f €",  products[line.productId]?.price ?: 0.0))
                    }
                }
            }

            val price = lines.sumOf { it.amount * (products[it.productId]?.price ?: 0.0) }
            Row() {
                Text(
                    "Total",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.weight(1f))

                Text(
                    String.format("%.2f €", price),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}