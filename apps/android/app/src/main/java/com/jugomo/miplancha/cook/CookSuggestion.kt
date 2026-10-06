package com.jugomo.miplancha.cook

import com.google.firebase.Timestamp
import com.jugomo.miplancha.auth.OrderLine
import com.jugomo.miplancha.shared.ProductInfo
import kotlin.collections.emptyList

fun computeSuggestion(
    pendingLines: List<OrderLine>,
    cookingLines: List<OrderLine>,
    products: Map<String, ProductInfo>,
    grillCapacity: Int,
    overflowPercent: Int,
    overflowManualActive: Boolean,
    maxWaitSeconds: Int,
    thresoldDivision: Int,
    subgroupSize: Int,
    now: Timestamp = Timestamp.now()
) : SuggestionResult {
    if(grillCapacity <= 0 || maxWaitSeconds <= 0) {
        return SuggestionResult(lines = emptyList(), alerts = emptyList(), capacityAfter = 0)
    }

    val capacidadExtendida = (grillCapacity * (1 + overflowPercent / 100.0)).toInt()

    val cookingUsed = cookingLines.sumOf { line ->
        (products[line.productId]?.capacity ?: 0) * line.amount
    }

    data class OrderCandidate(
        val orderId: String,
        val tableNumber: Int,
        val createdAt: Timestamp,
        val urgency: Double,
        val isForced: Boolean,
        val candidateLines: List<OrderLine>
    )

    val pendingByOrder = pendingLines.groupBy { it.orderId }
    val cookingByOrder = cookingLines.groupBy { it.orderId }

    val candidates = pendingByOrder.mapNotNull { (orderId, pending) ->
        val earliest = pending.minByOrNull { it.createdAt }?.createdAt ?: return@mapNotNull null
        val waitSeconds = now.seconds - earliest.seconds
        val urgency = waitSeconds.toDouble() / maxWaitSeconds
        val isForced = urgency >= 1.0
        val totalLines = pending.size + (cookingByOrder[orderId]?.size ?: 0)

        val candidateLines = if(totalLines > thresoldDivision) {
            pending.sortedBy { it.createdAt }.take(subgroupSize)
        } else {
            pending.sortedBy { it.createdAt }
        }

        OrderCandidate(
            orderId = orderId,
            tableNumber = candidateLines.firstOrNull()?.tableNumber ?: 0,
            createdAt = earliest,
            urgency = urgency,
            isForced = isForced,
            candidateLines = candidateLines
        )
    }

    val sortedCandidates = candidates.sortedWith { it1, it2 ->
        if (it1.isForced != it2.isForced) {
            if (it1.isForced) {
                return@sortedWith -1
            } else {
                return@sortedWith 1
            }
        }
        if (it1.isForced) {
            return@sortedWith it2.urgency.compareTo(it1.urgency)
        }
        return@sortedWith it1.createdAt.compareTo(it2.createdAt)
    }

    var usedCapacity = cookingUsed
    val suggestion = mutableListOf<SuggestionLine>()
    val alerts = mutableListOf<SuggestionAlert>()
    val includedLineIds = mutableSetOf<String>()

    for (order in sortedCandidates) {
        for (line in order.candidateLines) {
            val needed = (products[line.productId]?.capacity ?: 0) * line.amount
            val libreBase = maxOf(0, grillCapacity - usedCapacity)
            val libreExtendida = maxOf(0, capacidadExtendida - usedCapacity)
            val libreActual = if (overflowManualActive) libreExtendida else libreBase

            if (needed <= libreActual) {
                usedCapacity += needed
                suggestion.add(
                    SuggestionLine(
                        id = line.id,
                        orderId = order.orderId,
                        tableNumber = order.tableNumber,
                        productId = line.productId,
                        amount = line.amount,
                        isForced = order.isForced,
                        usingOverflow = usedCapacity > grillCapacity
                    )
                )
                includedLineIds.add(line.id)
            } else if(order.isForced && !overflowManualActive && needed <= libreExtendida) {
                usedCapacity += needed
                suggestion.add(
                    SuggestionLine(
                        id = line.id,
                        orderId = order.orderId,
                        tableNumber = order.tableNumber,
                        productId = line.productId,
                        amount = line.amount,
                        isForced = true,
                        usingOverflow = true
                    )
                )
                includedLineIds.add(line.id)
            } else if (order.isForced) {
                alerts.add(
                    SuggestionAlert(
                        id = order.orderId,
                        tableNumber = order.tableNumber
                    )
                )
            }
        }
    }

    val presentProductIds = suggestion.map { it.productId }.toSet()
    for (productId in presentProductIds) {
        val extras = pendingLines
            .filter { it.productId == productId && !includedLineIds.contains(it.id) }
            .sortedBy { it.createdAt }
        for (line in extras) {
            val needed = (products[productId]?.capacity ?: 0) * line.amount
            val libreExtendida = maxOf(0, capacidadExtendida - usedCapacity)
            val libreActual = if (overflowManualActive) libreExtendida else maxOf(0, grillCapacity - usedCapacity)

            if(needed > libreActual) { continue }

            val orderId = line.orderId
            val tableNumber = line.tableNumber
            usedCapacity += needed

            suggestion.add(
                SuggestionLine(
                    id = line.id,
                    orderId = orderId,
                    tableNumber = tableNumber,
                    productId = productId,
                    amount = line.amount,
                    isForced = false,
                    usingOverflow = usedCapacity > grillCapacity
                )
            )
            includedLineIds.add(line.id)
        }
    }

    return SuggestionResult(
        lines = suggestion,
        alerts = alerts,
        capacityAfter = usedCapacity
    )
}

data class SuggestionLine (
    val id: String,
    val orderId: String,
    val tableNumber: Int,
    val productId: String,
    val amount: Int,
    val isForced: Boolean,
    val usingOverflow: Boolean
)

data class SuggestionAlert (
    val id: String,
    val tableNumber: Int
)

data class SuggestionResult(
    val lines : List<SuggestionLine>,
    val alerts: List<SuggestionAlert>,
    val capacityAfter: Int
)
