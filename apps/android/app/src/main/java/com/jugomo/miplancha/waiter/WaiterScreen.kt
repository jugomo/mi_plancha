package com.jugomo.miplancha.waiter

import android.util.Log
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import com.jugomo.miplancha.shared.RoleContainer
import kotlinx.coroutines.launch

@Composable
fun WaiterScreen(
    companyId: String
) {
    
    val tablesService = remember { TablesService() }


    LaunchedEffect(Unit) {
        val mesas = tablesService.startListeningTables(companyId).collect { mesas ->
            Log.e("MESAS", "***MESAS*****************************")
            Log.e("MESAS", mesas.toString())

            mesas?.map { mesa ->
                if(mesa.clienteId != null) {
                    val client = tablesService.cacheClient( mesa)
                    Log.e("MESAS", "***CLIENTE: " + mesa.clienteId!! + "*****************************")
                    Log.e("CLIENTE", client.toString())

                    Log.e("CLIENTS", "*** CLIENTS " + tablesService.clientsCache.toString() + "************************")
                }

            }
        }

    }

     Content()
}

@Composable
fun Content() {
    val scope = rememberCoroutineScope()

    Column {
        Text("Camarero")


    }
}