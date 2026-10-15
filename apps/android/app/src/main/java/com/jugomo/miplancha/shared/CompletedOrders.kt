package com.jugomo.miplancha.shared

import com.jugomo.miplancha.waiter.LineStatus

fun completedOrders(orders: List<CookOrder>, lines: List<OrderLine>) : List<CookOrder> {
    val filtered = lines.groupBy { it.orderId }
        .filter { it.value.all { l -> l.status == LineStatus.LISTO } }

    return orders.filter { it.id in filtered.keys }
}