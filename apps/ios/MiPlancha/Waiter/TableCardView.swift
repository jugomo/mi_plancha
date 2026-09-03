//
//  TableCardView.swift
//  MiPlancha
//
//  Created by julio on 26/08/2026.
//

import SwiftUI

struct TableCardView: View {
    private(set) var table: Table
    private(set) var clientName: String?
    let summary: TableOrderSummary?
    
    private var cardColor: Color? {
        switch table.status {
        case .libre:    return nil
        case .cobrar:   return .orange
        case .ocupada:
            switch summary?.worstStatus {
            case .pendingDelivery: return Color.orange.opacity(0.85)
            case .pending, .cooking: return Color.orange.opacity(0.35)
            default: return .green  // nil o .ready → idle
            }
        }
    }
    private var textColor: Color { cardColor == nil ? .primary : .primary }
    private var subtextColor: Color { cardColor == nil ? .secondary : .primary.opacity(0.7) }

    var body: some View {
        VStack(spacing: 4) {
            Text("\(table.number)")
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(textColor)
            
//            Text(table.status.rawValue)
//                .font(.caption)
//                .foregroundStyle(.white.opacity(0.85))
    
            Text(clientName ?? " ")
                .font(.caption)
                .foregroundStyle(textColor)
                .opacity(clientName != nil ? 1 : 0)
            
            Label(summary?.worstStatus.label ?? " ",
                  systemImage: summary != nil ? statusIcon(summary!.worstStatus) : "clock")
                .font(.caption)
                .foregroundStyle(textColor)
                .opacity(summary != nil ? 1 : 0)
            
            Text(summary?.lastUpdate ?? Date(), style: .relative)
                .font(.caption2)
                .foregroundStyle(subtextColor)
                .opacity(summary != nil ? 1 : 0)
        
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.vertical, 24)
        .background(cardColor ?? .clear)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(cardColor == nil ? Color.secondary.opacity(0.3) : .clear, lineWidth: 2)
        )
    }
    
    private func statusIcon(_ status: LineStatus) -> String {
        switch status {
        case .pending: return "clock"
        case .cooking: return "flame"
        case .pendingDelivery : return "bell"
        default: return "checkmark.circle"
        }
    }
}

#Preview {
    TableCardView(
        table: Table(id: "1234", number: 1, status: .cobrar),
        clientName: "rufus",
        summary: TableOrderSummary(worstStatus: .cooking, lastUpdate:    .now)
    )
}
