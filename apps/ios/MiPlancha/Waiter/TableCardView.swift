//
//  TableCardView.swift
//  MiPlancha
//
//  Created by julio on 26/08/2026.
//

import SwiftUI

struct TableCardView: View {
    private(set) var table: Table
    
    private var color: Color {
        switch table.status {
        case .libre:    return .green
        case .ocupada:  return .blue
        case .cobrar:   return .orange
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            Text("\(table.number)")
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(.white)
            Text(table.status.rawValue)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(color)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    TableCardView(table: Table(id: "1234", number: 1, status: .cobrar))
}
