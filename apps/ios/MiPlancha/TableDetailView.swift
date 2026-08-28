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
    @State private var showingAddLine = false
    
    
    var body: some View {
         
        List(service.lines) { line in
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(line.status.color)
                    .frame(width: 5)
                Text("\(line.amount)x").fontWeight(.bold)
                Text(service.productNames[line.productId] ?? line.productId)
                Spacer()
                Text(line.status.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .swipeActions {
                Button("Entregado") {
                    Task { try? await service.markDelivered(lineId: line.id) }
                }
                .tint(.green)
            }
        }
        .overlay {
            if service.lines.isEmpty{
                ContentUnavailableView("Sin pedidos", systemImage: "checkmark.circle")
            }
        }
        .navigationTitle("Mesa \(table.number)")
        .onAppear { service.startListening(tableNumber: table.number, companyId: companyId ) }
        .onDisappear { service.stopListening() }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("add") {showingAddLine = true}
            }
        }
        .sheet(isPresented: $showingAddLine) {
            AddLineView(service: service)
        }
        
    }
}

#Preview {
    NavigationStack {
        TableDetailView(table: .init(id: "1", number: 1, status: .ocupada), companyId: "V628")
    }
}
