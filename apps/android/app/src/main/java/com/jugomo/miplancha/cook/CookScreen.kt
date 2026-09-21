package com.jugomo.miplancha.cook

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch

@Composable
fun CookScreen(
    companyId: String
) {
    val scope = rememberCoroutineScope()

    Column {
        Text("Cocinero")

    }

}