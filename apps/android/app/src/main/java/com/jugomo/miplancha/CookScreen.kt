package com.jugomo.miplancha

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch

@Composable
fun CookScreen(
    companyId: String,
    onLogout: suspend () -> Unit
) {
    val scope = rememberCoroutineScope()

    Column {
        Text("Cocinero")

        Button(
            onClick = {
                scope.launch {
                    onLogout()
                }
            }
        ) {
            Text("logut")
        }
    }

}