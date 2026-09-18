package com.jugomo.miplancha

import android.util.Log
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch

@Composable
fun WaiterScreen(
    companyId: String,
    onLogout: suspend () -> Unit
) {
    val scope = rememberCoroutineScope()
    val tablesService = remember { TablesService() }


    LaunchedEffect(Unit) {
        val mesas = tablesService.startListeningTables(companyId).collect { mesas ->
            Log.e("MESAS", "***MESAS*****************************")
            Log.e("MESAS", mesas.toString())

            mesas?.map { mesa ->
                if(mesa.clienteId != null) {
                    val client = tablesService.startListeningClient(companyId, mesa.clienteId!!).collect { clientes ->
                        Log.e("MESAS", "***CLIENTES*****************************")
                        Log.e("CLIENTE", clientes.toString())
                    }
                }

            }
        }

    }

    Column {
        Text("Camarero")

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
