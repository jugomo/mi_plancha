package com.jugomo.miplancha.waiter

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot

data class Table(
    var id: String,
    var numero: Int,
    var estado: TableStatus,
    var clienteId: String? = null
) {
}

data class TableOrderSummary(
    var worstStatus: LineStatus,
    var lastUpdate: Timestamp,
    var displayLabel: String? = null
) {
}

fun DocumentSnapshot.toTable() : Table  = Table(
    id = id,
    numero = getLong("numero")?.toInt() ?: 0,
    estado = TableStatus.valueOf((getString("estado") ?: "").uppercase()),
    clienteId = getString("clienteId")
)

enum class TableStatus {
    LIBRE,
    OCUPADA
}

enum class LineStatus {
    PENDIENTE,
    EN_PLANCHA,
    PENDIENTE_ENTREGA,
    LISTO;

    val label: String get() = when(this) {
        PENDIENTE -> "Esperando cocina"
        EN_PLANCHA -> "Cocinando"
        PENDIENTE_ENTREGA -> "Para entregar"
        LISTO -> "Entregado"
    }

    val color get() = when (this) {
        PENDIENTE -> Color(0xFFFFCC00)
        EN_PLANCHA -> Color(0xFFFF9500)
        PENDIENTE_ENTREGA -> Color(0xFF007AFF)
        LISTO -> Color(0xFF34C759)
    }

    val icon: ImageVector get() = when(this) {
        PENDIENTE -> Icons.Outlined.Schedule
        EN_PLANCHA -> Icons.Filled.LocalFireDepartment
        PENDIENTE_ENTREGA -> Icons.Outlined.Notifications
        LISTO -> Icons.Outlined.CheckCircle
    }
}

fun worstStatus(statuses: List<LineStatus>?): LineStatus? {
    fun priority(status: LineStatus) = when (status) {
        LineStatus.PENDIENTE -> 0
        LineStatus.EN_PLANCHA -> 1
        LineStatus.PENDIENTE_ENTREGA -> 2
        LineStatus.LISTO -> 3
    }

    return statuses?.minByOrNull { priority(it) }
}
