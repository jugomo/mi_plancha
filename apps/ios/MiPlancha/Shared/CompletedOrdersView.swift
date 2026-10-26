//
//  CompletedOrdersView.swift
//  MiPlancha
//
//  Created by julio on 26/10/2026.
//

import SwiftUI

struct CompletedOrdersView: View {
    let companyId: String
    let userId: String
    let field: String
    
    @State private var service = CompletedOrdersService()
    @State private var toDelete : OrderSummary?
    
    var body: some View {
        Group {
            if service.orders == nil || service.lines == nil{
                ProgressView()
            } else if service.completed.isEmpty {
                ContentUnavailableView(
                    "Todavía no tienes pedidos completados",
                    systemImage: "checklist"
                )
            } else {
                List {
                    ForEach(service.completed) { order in
                        HStack {
                            Text("Mesa \(order.tableNumber) ·")
                                .bold()
                            Text(order.clientName)
                            Spacer()
                            if order.billId != nil {
                                Button("Borrar") {
                                    toDelete = order
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Pedidos completados")
        .onAppear {
            service.startListening(
                companyId: companyId,
                field: field,
                userId: userId
            )
        }
        .onDisappear {
            service.stopListening()
        }
        .alert(
            "Confirma borrado",
            isPresented: Binding(
                get: { toDelete != nil },
                set: { if !$0 { toDelete = nil } }
            ),
            presenting: toDelete
        ) { order in
            Button("Borrar", role: .destructive) {
                Task {
                    do {
                        try await service.deleteOrder(orderId: order.id)
                    } catch {
                        print("ERROR: \(error)")
                    }
                }
            }
            Button("Cancelar", role: .cancel) { }
        } message: { order in
            Text("¿Estás seguro de borrar el pedido de la mesa \(order.tableNumber)?")
        }
    }

}

#Preview {
    NavigationStack {
        CompletedOrdersView(
            companyId: "preview-company",
            userId: "preview-user",
            field: "camareroId"
        )
    }
}

