package com.jugomo.miplancha.waiter

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot

data class Mesa(
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

fun DocumentSnapshot.toMesa() : Mesa  = Mesa(
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