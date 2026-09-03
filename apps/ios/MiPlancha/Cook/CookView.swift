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
    @State private var showingPlanchaLlena = false

    var body: some View {
        TabView {
            orders()
                .tabItem { Label("Pedidos", systemImage: "rectangle.stack") }
            
            grill()
                .tabItem { Label("Plancha", systemImage: "rectangle.stack") }
        }
        .navigationTitle("")
    }
    
    @ViewBuilder func orders() -> some View {
        let pending = service.lines.filter { $0.status == .pending }
        let cooking = service.lines.filter { $0.status == .cooking }
        
        List {
            Section("En curso") {
                ForEach(cooking) { line in
                    lineRow(line)
                }
            }
            Section("Pendientes") { 
                ForEach(pending) { line in
                    lineRow(line)
                }
            }
            
        }
        .overlay {
            if service.lines.isEmpty {
                ContentUnavailableView("Sin pedidos", systemImage: "checkmark.circle")
            }
        }
        .alert("Plancha llena", isPresented: $showingPlanchaLlena) {
            Button("Ok", role: .cancel, action: {})
        } message: {
            Text("No puedes servir más pedidos, la plancha ya está llena")
        }
        .navigationTitle("Cocina")
        .onAppear { service.startListening(companyId: companyId) }
        .onDisappear { service.stopListening() }
    }
    
    @ViewBuilder func grill() -> some View {
        Text("grill")
    }
    
    @ViewBuilder func lineRow(_ line: OrderLine) -> some View {
        VStack {
            HStack (spacing: 12){
                RoundedRectangle(cornerRadius: 3)
                    .fill(line.status.color)
                    .frame(width: 5)
                Text("M\(line.tableNumber)").fontWeight(.bold).foregroundStyle(.secondary)
                Spacer()
                Text(service.products[line.productId]?.name ?? line.productId)
                Text("\(line.amount)x")
            }
            HStack {
                Text(line.status.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(line.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .swipeActions {
            Button(line.status == .pending ? "Cocinar" : "Listo") {
                Task {
                    do {
                        try await service.advance(lineId: line.id, currentStatus: line.status)
                    } catch CookError.fullGrill {
                        showingPlanchaLlena = true
                    } catch {}
                }
            }
            .tint(line.status == .pending ? .orange : .green)
        }
    }
}

#Preview {
    NavigationStack { CookView(companyId: "V628") }
}
