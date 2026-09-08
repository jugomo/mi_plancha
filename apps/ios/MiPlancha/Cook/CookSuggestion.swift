
//
//  CoockSuggestion.swift
//  MiPlancha
//
//  Created by julio on 08/09/2026.
//
import Foundation

struct SugggestionLine : Identifiable {
    let id: String
    let orderId: String
    let tableNumber: Int
    let productId: String
    let amount : Int
    let isForced : Bool
    let usingOverflow: Bool
}

struct SuggestionAlert: Identifiable {
    let id: String
    let tableNumber: Int
}

struct SuggestionResult {
    let lines: [SugggestionLine]
    let alerts : [SuggestionAlert]
    let capacityAfter: Int
}

func computeSuggestion(
    pendingLines: [OrderLine],
    cookingLines: [OrderLine],
    products: [String:ProductInfo],
    grillCapacity: Int,
    overflowPercent: Int,
    overflowManualActive: Bool,
    maxWaitSeconds: Int,
    thresoldDivision: Int,
    subgroupSize: Int,
    now: Date = .now
) -> SuggestionResult{
    
    guard grillCapacity > 0, maxWaitSeconds > 0 else {
        return SuggestionResult(lines: [], alerts: [],  capacityAfter: 0)
    }

    let capacidadExtendida = Int(Double(grillCapacity) * (1.0 + Double(overflowPercent) / 100.0))

    let cookingUsed = cookingLines.reduce(0) { sum, line in
        sum + (products[line.productId]?.capacidadUnidad ?? 0) * line.amount
    }

    struct OrderCandidate {
        let orderId: String
        let tableNumber: Int
        let createdAt: Date
        let urgency: Double
        let isForced: Bool
        let candidateLines: [OrderLine]
    }

    let pendingByOrder = Dictionary(grouping: pendingLines, by: \.orderId)
    let cookingByOrder = Dictionary(grouping: cookingLines, by: \.orderId)

    var candidates: [OrderCandidate] = pendingByOrder.compactMap { orderId, pending in
        guard let earliest = pending.map(\.createdAt).min() else { return nil }
        let tableNumber = pending.first?.tableNumber ?? 0
        let waitSeconds = now.timeIntervalSince(earliest)
        let urgency = waitSeconds / Double(maxWaitSeconds)
        let isForced = urgency >= 1.0

        let totalLines = pending.count + (cookingByOrder[orderId]?.count ?? 0)
        let candidateLines: [OrderLine]
        if totalLines > thresoldDivision {
            candidateLines = Array(pending.sorted { $0.createdAt < $1.createdAt }.prefix(subgroupSize))
        } else {
            candidateLines = pending.sorted { $0.createdAt < $1.createdAt }
        }

        return OrderCandidate(
            orderId: orderId, tableNumber: tableNumber,
            createdAt: earliest, urgency: urgency,
            isForced: isForced, candidateLines: candidateLines
        )
    }

    candidates.sort { a, b in
        if a.isForced != b.isForced { return a.isForced }
        if a.isForced && b.isForced { return a.urgency > b.urgency }
        return a.createdAt < b.createdAt
    }

    var usedCapacity = cookingUsed
    var suggestion: [SugggestionLine] = []
    var alerts: [SuggestionAlert] = []
    var includedLineIds = Set<String>()

    for order in candidates {
        for line in order.candidateLines {
            let needed = (products[line.productId]?.capacidadUnidad ?? 0) * line.amount

            let libreBase = max(0, grillCapacity - usedCapacity)
            let libreExtendida = max(0, capacidadExtendida - usedCapacity)
            let libreActual = overflowManualActive ? libreExtendida : libreBase

            if needed <= libreActual {
                usedCapacity += needed
                suggestion.append(SugggestionLine(
                    id: line.id, orderId: order.orderId, tableNumber: order.tableNumber,
                    productId: line.productId, amount: line.amount,
                    isForced: order.isForced,
                    usingOverflow: usedCapacity > grillCapacity
                ))
                includedLineIds.insert(line.id)
            } else if order.isForced && !overflowManualActive && needed <= libreExtendida {
                usedCapacity += needed
                suggestion.append(SugggestionLine(
                    id: line.id, orderId: order.orderId, tableNumber: order.tableNumber,
                    productId: line.productId, amount: line.amount,
                    isForced: true, usingOverflow: true
                ))
                includedLineIds.insert(line.id)
            } else if order.isForced {
                alerts.append(SuggestionAlert(id: order.orderId, tableNumber: order.tableNumber))
            }
        }
    }

    let presentProductIds = Set(suggestion.map(\.productId))
    for productId in presentProductIds {
        let extras = pendingLines
            .filter { $0.productId == productId && !includedLineIds.contains($0.id) }
            .sorted { $0.createdAt < $1.createdAt }
        for line in extras {
            let needed = (products[productId]?.capacidadUnidad ?? 0) * line.amount
            let libreExtendida = max(0, capacidadExtendida - usedCapacity)
            let libreActual = overflowManualActive ? libreExtendida : max(0, grillCapacity - usedCapacity)
            guard needed <= libreActual else { continue }
            let orderId = line.orderId
            let tableNumber = line.tableNumber
            usedCapacity += needed
            suggestion.append(SugggestionLine(
                id: line.id, orderId: orderId, tableNumber: tableNumber,
                productId: productId, amount: line.amount,
                isForced: false, usingOverflow: usedCapacity > grillCapacity
            ))
            includedLineIds.insert(line.id)
        }
    }

    return SuggestionResult(
        lines: suggestion,
        alerts: alerts,
        capacityAfter: usedCapacity )
}
