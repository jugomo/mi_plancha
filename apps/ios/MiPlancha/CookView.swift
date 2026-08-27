//
//  CookView.swift
//  MiPlancha
//
//  Created by julio on 27/08/2026.
//

import SwiftUI

struct CookView: View {
    let companyId: String
    @State private var service = CookLinesService()

    var body: some View {
        List(service.lines) { line in
            HStack {
                Text("M\(line.tableNumber)").fontWeight(.bold).foregroundStyle(.secondary)
                Text(service.productNames[line.productId] ?? line.productId)
                Spacer()
                Text("\(line.amount)x")
            }
            .swipeActions {
                Button(line.status == .pending ? "Cocinar" : "Listo") {
                    Task { try? await service.advance(lineId: line.id, currentStatus: line.status) }
                }
                .tint(line.status == .pending ? .orange : .green)
            }
        }
        .navigationTitle("Cocina")
        .onAppear { service.startListening(companyId: companyId) }
        .onDisappear { service.stopListening() }
    }
}

#Preview {
    NavigationStack { CookView(companyId: "V628") }
}
