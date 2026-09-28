package com.jugomo.miplancha.waiter

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

@Composable
fun OpenTableDialog(
    tableNumber: Int,
    onConfirm: (clientName : String) -> Unit,
    onDismiss: () -> Unit
) {
    var nombreCliente by remember { mutableStateOf("") }

    AlertDialog(
    onDismissRequest = {
        onDismiss()
    },
    title = { Text("Abrir mesa ${tableNumber}") },
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
               onConfirm(nombreCliente)
            }
        ) { Text("Abrir") }
    },
    dismissButton = {
        TextButton(
            onClick = {
                onDismiss()
            }
        ) {
            Text("Cancelar")
        }
    }
    )
}