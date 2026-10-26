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

