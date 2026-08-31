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
    @State private var showingOpenAlert = false
    @State private var clientName = ""
    @State private var showingCuenta = false
    
    var body: some View {
        List(service.lines) { line in
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(line.status.color)
                    .frame(width: 5)
                Text("\(line.amount)x").fontWeight(.bold)
                Text(service.products[line.productId]?.name ?? line.productId)
                Spacer()
                Text(line.status.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .swipeActions {
                if line.status == .pedingDelivery {
                    Button("Entregado") {
                        Task { try? await service.markDelivered(lineId: line.id) }
                    }
                    .tint(.green)
                }
            }
        }
        .overlay {
            if service.tableStatus == .libre {
                ContentUnavailableView {
                    Label("Mesa cerrada", systemImage: "door.left.hand.closed")
                } description: {
                    Text("Abre la mesa para empezar a tomar pedidos")
                } actions: {
                    Button("Abrir mesa") { showingOpenAlert = true }
                        .buttonStyle(.borderedProminent)
                }
            } else if service.lines.isEmpty {
                ContentUnavailableView("Sin pedidos", systemImage: "checkmark.circle")
            }
        }
        .alert("Nombre del cliente", isPresented: $showingOpenAlert) {
            TextField("Nombre", text: $clientName)
            Button("Abrir") {
                let name = clientName
                clientName = ""
                Task { try? await service.openTable(tableId: table.id, clientName: name) }
            }
            Button("Cancelar", role: .cancel) { clientName = "" }
        }
        .navigationTitle("Mesa \(table.number)")
        .onAppear { service.startListening(tableNumber: table.number, companyId: companyId ) }
        .onDisappear { service.stopListening() }
        .toolbar {
            if service.tableStatus == .ocupada {
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("add") {showingAddLine = true}
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("🫰🏼") { showingCuenta = true }
                }
            }
        }
        .sheet(isPresented: $showingAddLine) {
            AddLineView(service: service)
        }
        .sheet(isPresented: $showingCuenta, content: {
            CuentaView(tableId: table.id, service: service)
        })
    }
    
}

#Preview {
    NavigationStack {
        TableDetailView(table: .init(id: "1", number: 1, status: .ocupada), companyId: "V628")
    }
    .environment(TablesService())
}
