package com.jugomo.miplancha.waiter

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import com.jugomo.miplancha.shared.ProductInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddLineSheet(
    products: Map<String, ProductInfo>,
    grillCapacity: Int?,
    sending: Boolean,
    onSend: (Map<String, Int>) -> Unit,
    onDismiss: () -> Unit,
) {
    val quantities = remember { mutableStateMapOf<String, Int>() }
    val available = products.filter { it.value.stock > 0 }.entries.sortedBy { it.value.name }

    fun isOverCapacity(entry: Map.Entry<String, ProductInfo>)  : Boolean {
        return grillCapacity != null &&
                (entry.value.capacity * (quantities[entry.key] ?: 0)) > grillCapacity
    }

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
            ){
                Button(
                    onClick = onDismiss
                ) {
                    Text("Cancelar")
                }

                Spacer(Modifier.weight(1f))

                Button(
                    onClick = {
                        onSend(quantities.filter {  (productId, amount) ->
                            amount > 0
                        })
                    },
                    enabled = !sending &&
                                 quantities.values.any { it > 0 } &&
                                    available.none {isOverCapacity(it)}
                ) {
                    Text("Enviar")
                }
            }

            Text(
                "Nuevo pedido",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )

            LazyColumn(
                modifier = Modifier
                    .padding(top = 24.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer)
                    .padding(horizontal = 16.dp)
            ) {
                itemsIndexed(available, key = { _, entry -> entry.key }) { index, entry ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 16.dp)
                    ) {
                        // product name & availability
                        Column(
                            modifier = Modifier.weight(1f).padding(end = 16.dp)
                        ) {
                            Text(
                                entry.value.name,
                                fontSize = 24.sp,
                            )
                            Text(
                                "disponible: ${entry.value.stock}",
                                fontSize = 18.sp,
                                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                            )
                        }

                        // buttons select amount
                        Column(
                            horizontalAlignment = Alignment.End
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Button(
                                    onClick = {
                                        quantities[entry.key] = (quantities[entry.key] ?: 0) - 1
                                    },
                                    enabled = (quantities[entry.key] ?: 0) > 0
                                ) {
                                    Text("-")
                                }

                                Text(
                                    "${quantities[entry.key] ?: 0}",
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.width(40.dp),
                                    textAlign = TextAlign.Center
                                )

                                Button(
                                    onClick = {
                                        quantities[entry.key] = (quantities[entry.key] ?: 0) + 1
                                    },
                                    enabled = (quantities[entry.key] ?: 0) < entry.value.stock
                                ) {
                                    Text("+")
                                }
                            }
                        }
                    }

                    if(isOverCapacity(entry)) {
                        Text(
                            "Supera la capacidad de la parrilla",
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.End,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if(index < available.lastIndex) {
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun AddLineSheetPreview() {
    AddLineSheet(
        products = mapOf(
            "p1" to ProductInfo("Chuletón", 32.5, 10, 2, 600),
            "p2" to ProductInfo("Secreto ibérico", 18.0, 4, 1, 300),
            "p3" to ProductInfo("Pimientos", 6.0, 0, 1, 240)
        ),
        grillCapacity = 20,
        onSend = {},
        sending = false,
        onDismiss = {}
    )
}
