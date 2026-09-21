package com.jugomo.miplancha

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.jugomo.miplancha.auth.AuthService
import com.jugomo.miplancha.auth.LoginScreen
import com.jugomo.miplancha.auth.Rol
import com.jugomo.miplancha.auth.Usuario
import com.jugomo.miplancha.cook.CookScreen
import com.jugomo.miplancha.shared.RoleContainer
import com.jugomo.miplancha.waiter.WaiterScreen

/**
 * Placeholder de arranque. Sin lógica de negocio todavía: solo confirma que
 * el proyecto nativo está inicializado y compila.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MiPlanchaPlaceholder()
        }
    }
}

@Composable
fun MiPlanchaPlaceholder() {
    val authService = remember { AuthService() }
    val usuario: Usuario? by authService.mutableUser.collectAsState()

    LaunchedEffect(Unit) {
        authService.restoreSessionIfActiveUser()
    }

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                if(usuario == null) {
                    LoginScreen(
                        onLogin = { companyId, username, password ->
                            authService.startSession(companyId, username, password)
                        }
                    )
                } else {
                    if(usuario!!.rol == Rol.COCINERO) {
                        RoleContainer(
                            usuario = usuario!!,
                            onLogout =  {
                                authService.closeSession()
                            }
                        ){
                            CookScreen(
                                companyId = usuario!!.empresaId!!,
                            )
                        }
                    } else if(usuario!!.rol == Rol.CAMARERO) {
                        RoleContainer (
                            usuario = usuario!!,
                            onLogout = {
                                authService.closeSession()
                            }
                        ) {
                            WaiterScreen(
                                companyId = usuario!!.empresaId!!
                            )
                        }
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun MiPlanchaPlaceholderPreview() {
    MiPlanchaPlaceholder()
}
