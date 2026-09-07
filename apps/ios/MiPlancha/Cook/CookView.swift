//
//  CookView.swift
//  MiPlancha
//
//  Created by julio on 27/08/2026.
//

import SwiftUI

struct CookView: View {
    let companyId: String
    let userId: String
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
        .onAppear {service.startListening(companyId: companyId)}
        .onDisappear {service.stopListening()}
        
    }
    
    @ViewBuilder func orders() -> some View {
        let pending = service.lines.filter { $0.status == .pending }
        let cooking = service.lines.filter { $0.status == .cooking }
        
        List {
            Section("En curso") {
                let grouped: [String : [OrderLine]] = Dictionary(grouping: cooking, by: \.orderId)
                let cookingByOrder = grouped.sorted { a,b in
                    let aDate = (a.value.map(\.createdAt).min() ?? .distantFuture)
                    let bDate = (b.value.map(\.createdAt).min() ?? .distantFuture)
                    return aDate < bDate
                }
                ForEach(cookingByOrder, id: \.key) { orderId, orderLines in
                    HStack {
                        let tableNumber: Int = orderLines.first?.tableNumber ?? 0
                        Text("Mesa \(tableNumber)").fontWeight(.semibold)
                        Spacer()
                    }
                    .listRowBackground(Color(.systemGray6))
                    .padding(.vertical, 10)
                    
                    ForEach(orderLines) { line in
                        lineRow(line)
                    }
                }
            }
            Section("Pendientes") {
                let grouped: [String : [OrderLine]] = Dictionary(grouping: pending, by: \.orderId)
                let pendingByOrder = grouped.sorted { a,b in
                        let aDate = (a.value.map(\.createdAt).min() ?? .distantFuture)
                        let bDate = (b.value.map(\.createdAt).min() ?? .distantFuture)
                        return aDate < bDate
                }
                ForEach(pendingByOrder, id: \.key) { orderId, orderLines in
                    HStack {
                        let tableNumber: Int = orderLines.first?.tableNumber ?? 0
                        Text("Mesa \(tableNumber)").fontWeight(.semibold)
                        Spacer()
                        Button("Tomar pedido") {
                            Task {
                                for line in orderLines {
                                    do {
                                        try await service.advance(lineId: line.id, currentStatus: line.status, userId: userId)
                                    } catch CookError.fullGrill {
                                        showingPlanchaLlena = true
                                        return
                                    } catch {}
                                }
                            }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        
                    }
                    .listRowBackground(Color(.systemGray6))
                    
                    ForEach(orderLines) { line in
                        lineRow(line)
                    }
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
        let cooking = service.lines.filter { $0.status == .cooking }
        let inUse = cooking.reduce(0) { sum, line in
            sum + (service.products[line.productId]?.capacidadUnidad ?? 0) * line.amount
        }
        
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Capacidad")
                        Spacer()
                        Text("\(inUse) / \(service.efectiveCapacity ?? 0)")
                            .foregroundStyle(.secondary)
                    }
                    if let cap = service.efectiveCapacity {
                        ProgressView(value: Double(inUse), total: Double(max(cap, 1)))
                            .tint(inUse >= cap ? .red : .orange)
                    
                        
                        if let pct = service.overflowPercent, pct > 0 {
                            Button {
                                Task {
                                    do {
                                        try await service.toggleOverflow(uid: userId)
                                    } catch {
                                        print("toggleOverflow error: \(error)")
                                    }
                                }
                            } label: {
                                Label(
                                    service.overflowManualActive ? "Overflow activo (+\(pct))%" : "Activar overflow (+\(pct))%",
                                    systemImage: service.overflowManualActive ? "flame.fill" : "flame"
                                )
                                .foregroundStyle(service.overflowManualActive ? .red : .secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            
            Section("En plancha") {
                ForEach(cooking) { line in
                    grillRow(line)
                }
            }
        }
        .navigationTitle("Plancha")
        .overlay {
            if cooking.isEmpty {
                ContentUnavailableView("Plancha vacia", systemImage: "checkmark.circle")
            }
        }
    }
    
    @ViewBuilder func lineRow(_ line: OrderLine) -> some View {
        VStack {
            HStack (spacing: 12){
                RoundedRectangle(cornerRadius: 3)
                    .fill(line.status.color)
                    .frame(width: 5)
//                Text("M\(line.tableNumber)").fontWeight(.bold).foregroundStyle(.secondary)
                Text(service.products[line.productId]?.name ?? line.productId)
                Text("\(line.amount)x")
                Spacer()
                
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
                        try await service.advance(lineId: line.id, currentStatus: line.status, userId: userId)
                    } catch CookError.fullGrill {
                        showingPlanchaLlena = true
                    } catch {}
                }
            }
            .tint(line.status == .pending ? .orange : .green)
        }
    }
    
    @ViewBuilder func grillRow(_ line: OrderLine) -> some View {
        let cookTime = service.products[line.productId]?.tiempoCoccionSeg ?? 0
        let start = line.cookedAt ?? line.createdAt

        VStack {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.orange)
                    .frame(width: 5)
                Text("M\(line.tableNumber)").fontWeight(.bold).foregroundStyle(.secondary)
                Spacer()
                Text(service.products[line.productId]?.name ?? line.productId)
                Text("\(line.amount)x")
            }
            TimelineView(.periodic(from: start , by: 10)) { context in
                let elapsed =  context.date.timeIntervalSince(start)
                let isDone = cookTime > 0 && elapsed >= Double()
                
                HStack {
                    Text(start, style: .relative)
                        .font(.caption).foregroundStyle(.secondary)
                    if cookTime > 0 {
                        Spacer()
                        if isDone {
                            Text("Listo")
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundStyle(.green)
                        } else {
                            Text("\(cookTime / 60) min")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .swipeActions {
            Button("Listo") {
                Task {
                    try? await service.advance(lineId: line.id, currentStatus: line.status, userId: userId)
                }
            }
            .tint(.green)
        }
    }
}

#Preview {
    NavigationStack { CookView(companyId: "V628", userId: "yomismo") }
}
