//
//  TableCardView.swift
//  MiPlancha
//
//  Created by julio on 26/08/2026.
//

import SwiftUI

struct TableCardView: View {
    private(set) var table: Table
    
    var body: some View {
        let bgcolor = switch (table.status) {
        case .cobrar:
            Color.orange
        case .ocupada:
            Color.red
        case .libre:
            Color.green
        }
        
        Text("Mesa: \(table.number)")
            .padding(24)
            .background(bgcolor)
            .clipShape(RoundedRectangle(cornerRadius: 24))
    }
}

#Preview {
    TableCardView(table: Table(id: "1234", number: 1, status: .cobrar))
}
