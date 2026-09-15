package com.jugomo.miplancha

import android.R.attr.enabled
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import kotlinx.coroutines.launch


@Composable
fun LoginScreen(onLogin: suspend (String, String, String) -> Unit) {
    val scope = rememberCoroutineScope()

    val companyId = remember { mutableStateOf("") }
    val username = remember { mutableStateOf("") }
    val password = remember { mutableStateOf("") }
    var error = remember { mutableStateOf("") }

    val isFormValid = companyId.value.isNotBlank() &&
                      username.value.isNotBlank() &&
                      password.value.isNotBlank()

    Column() {
        Row() {
            Text("company")
            TextField(
                companyId.value,
                onValueChange = { companyId.value = it }
            )
        }
        Row() {
            Text("username")
            TextField(
                username.value,
                onValueChange = { username.value = it }
            )
        }
        Row() {
            Text("password")
            TextField(
                password.value,
                onValueChange = { password.value = it },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )
        }
        Button(
            onClick = {
                scope.launch {
                    try {
                        onLogin(companyId.value, username.value, password.value)
                    } catch (e: AuthError) {
                        print("pinche")
                        error.value = e.message.toString()
                    }
                }
            },
            enabled = isFormValid
        ) {
            Text("Entrar")
        }
        if (!error.value.equals("")) {
            Text(error.value)
        }
    }

}
