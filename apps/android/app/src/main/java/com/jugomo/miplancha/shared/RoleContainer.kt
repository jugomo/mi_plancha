package com.jugomo.miplancha.shared

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.jugomo.miplancha.auth.Usuario
import kotlinx.coroutines.launch

@Composable
fun RoleContainer(
    usuario: Usuario,
    onLogout: suspend () -> Unit,
    content: @Composable () -> Unit
) {
    val scope = rememberCoroutineScope()
    val navController = rememberNavController()
    val currEntry = navController.currentBackStackEntryAsState().value // fires recomposition
    val canNavigateBack =  navController.previousBackStackEntry != null

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = usuario.nombre) },
                colors = TopAppBarColors(
                    containerColor = Color.Gray,
                    scrolledContainerColor = Color.Black,
                    navigationIconContentColor = Color.Black,
                    titleContentColor = Color.Black,
                    actionIconContentColor = Color.Black,
                    subtitleContentColor = Color.Black
                ),
                navigationIcon = {
                    if (canNavigateBack) {
                        IconButton(
                            onClick = {
                                navController.popBackStack()
                            }
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Regresar"
                            )
                        }
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            scope.launch { onLogout.invoke() }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = "logout"
                        )

                    }
                }
            )
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "Home"
        ) {
            composable("Home") {
                Box(
                    modifier = Modifier.padding(innerPadding)
                ) {
                    content()
                }
            }
        }
    }
}