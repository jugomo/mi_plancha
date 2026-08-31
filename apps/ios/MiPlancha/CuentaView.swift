//
//  CuentaView.swift
//  MiPlancha
//
//  Created by julio on 31/08/2026.
//

import SwiftUI

struct CuentaView : View {
    let tableId : String
    let service : LinesService
    @Environment(\.dismiss) private var dismiss
    
    private var  total: Double {
        service.billLines.reduce(0) { sum, line in
            sum + (service.products[line.productId]?.price ?? 0) * Double(line.amount)
        }
    }
    
    var body: some View {
        NavigationStack {
            List {
                ForEach(service.billLines) { line in
                    HStack {
                        Text(service.products[line.productId]?.name ?? line.productId)
                        Spacer()
                        Text("\(line.amount)x").foregroundStyle(.secondary)
                        Text(service.products[line.productId]?.price ?? 0, format: .currency(code: "EUR"))
                    }
                    
                }
                Section {
                    HStack {
                        Text("Total").fontWeight(.bold)
                        Spacer()
                        Text(total, format: .currency(code: "EUR")).fontWeight(.bold)
                    }
                }
            }
            .navigationTitle("Cuenta mesa \(service.tableNumber)")
            .task { await service.fetchBillLines() }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cobrar y cerrar") {
                        Task {
                            try? await service.closeTable(tableId: tableId)
                            dismiss()
                        }
                    }
                    .tint(.green)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar", role: .cancel) { dismiss() }
                }
            }
        }
    }
    
    
}
