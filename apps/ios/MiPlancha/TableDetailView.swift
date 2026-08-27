//
//  TableDetailView.swift
//  MiPlancha
//
//  Created by julio on 26/08/2026.
//

import SwiftUI

struct TableDetailView: View {
    let table: Table
    let companyId: String
    @State private var service = LinesService()
    
    
    var body: some View {
        List (service.lines) { line in
            HStack{
                Text("\(line.amount)x").fontWeight(.bold)
                Text(line.productId)
                Spacer()
                Text(line.status.rawValue).foregroundStyle(.secondary)
            }
            .swipeActions {
                Button("Entregado") {
                    Task { try? await service.markDelivered(lineId: line.id) }
                }
                .tint(.green)
            }
        }
        .navigationTitle("Mesa \(table.number)")
        .onAppear { service.startListening(tableNumber: table.number, companyId: companyId ) }
        .onDisappear { service.stopListening() }
    }
}

#Preview {
    TableDetailView(table: .init(id: "1", number: 1, status: .ocupada), companyId: "V628")
}
