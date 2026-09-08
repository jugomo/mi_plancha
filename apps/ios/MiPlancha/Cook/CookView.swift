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
            Section {
                TimelineView(.periodic(from: .now, by: 30 )) { context in
                    if let cap = service.grillCapacity,
                       let displayCap = service.efectiveCapacity {
                        let cooking = service.lines.filter {$0.status == .cooking }
                        let pending = service.lines.filter {$0.status == .pending}
                        let result = computeSuggestion(pendingLines: pending, cookingLines: cooking, products: service.products, grillCapacity: cap, overflowPercent: service.overflowPercent ?? 0, overflowManualActive: service.overflowManualActive, maxWaitSeconds: service.maxWaitSeconds, thresoldDivision: service.thresoldDivision, subgroupSize: service.subgroupSize, now: context.date)
                        
                        suggestionCard(result: result, capacity: displayCap, hasPending: !pending.isEmpty) { lines in
                            Task {
                                for line in lines {
                                    do {
                                        try await service.advance(lineId: line.id, currentStatus: .pending, userId: userId)
                                    } catch CookError.fullGrill {
                                        showingPlanchaLlena = true
                                        return
                                    } catch {}
                                }
                            }
                            
                        }
                    }
                }
            }
            
            Section("En curso") {
                let grouped: [String : [OrderLine]] = Dictionary(grouping: cooking, by: \.orderId)
                let cookingByOrder = grouped.sorted { a,b in
                    let aDate = (a.value.map(\.createdAt).min() ?? .distantFuture)
                    let bDate = (b.value.map(\.createdAt).min() ?? .distantFuture)
                    return aDate < bDate
                }
                ForEach(cookingByOrder, id: \.key) { group in
                    let tableNumber: Int = group.value.first?.tableNumber ?? 0
                    
                    inCourseHeader(tableNumber: tableNumber, lines: group.value)

                    ForEach(group.value) { line in
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
                ForEach(pendingByOrder, id: \.key) { group in
                    let tableNumber: Int = group.value.first?.tableNumber ?? 0
                    
                    pendingHeader(tableNumber: tableNumber, lines: group.value)
                    
                    ForEach(group.value) { line in
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
                let grouped : [String : [OrderLine]] = Dictionary(grouping: cooking, by: \.orderId)
                let cookingByOrder = grouped.sorted { a,b in
                    let aDate = (a.value.map(\.createdAt).min() ?? .distantFuture)
                    let bDate = (b.value.map(\.createdAt).min() ?? .distantFuture)
                     return  aDate < bDate
                }
                
                ForEach(cookingByOrder, id: \.key) { orderId, orderLines in
                    HStack {
                        let tableNumber = orderLines.first?.tableNumber ?? 0
                        Text("Mesa \(tableNumber)").fontWeight(.semibold)
                        Spacer()
                        Button("Retirar de plancha") {
                            Task {
                                for line in orderLines {
                                    try? await service.advance(lineId: line.id, currentStatus: line.status, userId: userId)
                                }
                            }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                    .listRowBackground(Color(.systemGray6))
                    .padding(.vertical, 10)
                    
                    ForEach(cooking) { line in
                        grillRow(line)
                    }
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
    
    @ViewBuilder func inCourseHeader(tableNumber: Int, lines: [OrderLine]) -> some View {
        HStack {
            Text("Mesa \(tableNumber)").fontWeight(.semibold)
            Spacer()
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let allReady = lines.allSatisfy { line in
                    let cookTime = service.products[line.productId]?.tiempoCoccionSeg ?? 0
                    guard cookTime > 0 else { return true }
                    let start = line.cookedAt ?? line.createdAt
                    return context.date >= start.addingTimeInterval(Double(cookTime))
                }
                
                if allReady {
                    Button("Retirar de plancha") {
                        Task {
                            for line in lines {
                                try? await service.advance(lineId: line.id, currentStatus: line.status, userId: userId)
                            }
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
        .listRowBackground(Color(.systemGray6))
        .padding(.vertical, 10)
    }
    
    @ViewBuilder func pendingHeader(tableNumber: Int, lines: [OrderLine]) -> some View {
        HStack {
            Text("Mesa \(tableNumber)").fontWeight(.semibold)
            if lines.first?.status == .pending {
                Text(lines.first!.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Tomar pedido") {
                Task {
                    for line in lines {
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
    }
    
    @ViewBuilder func lineRow(_ line: OrderLine) -> some View {
        let cookTime = service.products[line.productId]?.tiempoCoccionSeg ?? 0
        let start = line.cookedAt ?? line.createdAt
        let doneAt = start.addingTimeInterval(Double(cookTime))
        
        VStack {
            HStack (spacing: 12){
                RoundedRectangle(cornerRadius: 3)
                    .fill(line.status.color)
                    .frame(width: 5)
                Text("\(line.amount)x")
                Text(service.products[line.productId]?.name ?? line.productId)
                Spacer()
                
            }
            if line.status == .pending {
                Text(line.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                TimelineView(.periodic(from: start, by:1 )) { context in
                    let isDone = cookTime > 0 && context.date >= doneAt
                    
                    HStack {
                        if cookTime > 0 {
                            Spacer()
                            if isDone {
                                Text("Listo")
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .foregroundStyle(.green)
                            } else {
                                Text(line.status.label)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(doneAt, style: .relative)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
//        .swipeActions {
//            Button(line.status == .pending ? "Cocinar" : "Listo") {
//                Task {
//                    do {
//                        try await service.advance(lineId: line.id, currentStatus: line.status, userId: userId)
//                    } catch CookError.fullGrill {
//                        showingPlanchaLlena = true
//                    } catch {}
//                }
//            }
//            .tint(line.status == .pending ? .orange : .green)
//        }
    }
    
    @ViewBuilder func grillRow(_ line: OrderLine) -> some View {
        let cookTime = service.products[line.productId]?.tiempoCoccionSeg ?? 0
        let start = line.cookedAt ?? line.createdAt
        let doneAt = start.addingTimeInterval(Double(cookTime))

        VStack {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.orange)
                    .frame(width: 5)
                Text("\(line.amount)x")
                Text(service.products[line.productId]?.name ?? line.productId)
                Spacer()
            }
            TimelineView(.periodic(from: start, by: 1)) { context in
                let isDone = cookTime > 0 && context.date >= doneAt
                
                HStack {
                    if cookTime > 0 {
                        Spacer()
                        if isDone {
                            Text("Listo")
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundStyle(.green)
                        } else {
                            Text(doneAt, style: .relative)
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

    func suggestionCard(result: SuggestionResult, capacity: Int, hasPending: Bool, onPlace: @escaping ([SugggestionLine]) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Sugerencia d e plancha", systemImage: "sparkles").font(.headline)
            
            if result.lines.isEmpty && result.alerts.isEmpty {
                if hasPending {
                    Text("La plancha esta llena, no hay espacio para sugerir pedidos ahora")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("No hay lineas pendientes que colocar")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                let byOrder = Dictionary(grouping: result.lines, by: \.orderId)
                ForEach(byOrder.keys.sorted(), id: \.self) { orderId in
                    let lines = byOrder[orderId]!
                    let tableNumber = lines.first!.tableNumber
                    let isForced = lines.contains {$0.isForced}
                    HStack {
                        Text("Mesa \(tableNumber)").fontWeight(.semibold)
                        if isForced {
                            Label("Urgente", systemImage: "exclamationmark.triangle")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                    ForEach(lines) { line in
                        HStack {
                            Text("  \(line.amount)× \(service.products[line.productId]?.name ?? line.productId)")
                                .font(.callout)
                            if line.usingOverflow {
                                Image(systemName: "flame.fill")
                                    .foregroundStyle(.orange)
                                    .font(.caption)
                            }
                        }
                    }
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Capacidad tras colocar")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text("\(result.capacityAfter) / \(capacity)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: Double(result.capacityAfter), total: Double(max(capacity, 1)))
                        .tint(result.capacityAfter > capacity ? .red : .orange)
                }

                ForEach(result.alerts) { alert in
                    Label("Mesa \(alert.tableNumber): urgente, no cabe ni con overflow", systemImage: "exclamationmark.octagon.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                if !result.lines.isEmpty {
                    Button("Colocar en plancha") {
                        onPlace(result.lines)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
        }
        .padding(.bottom, 8)
    }
    
}

#Preview {
    NavigationStack { CookView(companyId: "V628", userId: "yomismo") }
}
