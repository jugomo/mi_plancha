//
//  Untitled.swift
//  MiPlancha
//
//  Created by julio on 25/08/2026.
//

import SwiftUI

struct WaiterView: View {
    let companyId: String
    let columns = [GridItem(.adaptive(minimum: 120))]
    @State private var service = TablesService()
    @State private var tableToOpen: Table? = nil
    @State private var clientName = ""
    @State private var linesService = LinesService()
    @State private var tableForCuenta: Table? = nil
    
    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(service.tables) { table in
                    NavigationLink(destination: TableDetailView(table: table, companyId: companyId )) {    
                        TableCardView(table: table,
                                      clientName: service.clientNames[table.id],
                                      summary: summary(for: table))
                    }
                    .contextMenu{
                        if table.status == .libre {
                            Button("Acrir mesa") {
                                tableToOpen = table
                            }
                        } else {
                            if service.tableOrderInfo[table.number]?.worstStatus == .pendingDelivery {
                                Button("Entregar pedido") {
                                    Task { try? await service.deliverAllPending(tableNumber: table.number) }
                                }
                            }
                            Button("Cobrar") {
                                tableForCuenta = table
                            }
                        }
                    }
                }
            }.padding()
        }
        .environment(service)
        .onAppear {
            
             service.startListening(companyId: companyId)
        }
        .onDisappear {
            service.stopListening()
        }
         .navigationTitle("Mesas")
         .alert("Nombre del cliente", isPresented: Binding(
            get: { tableToOpen != nil },
            set: { if !$0 { tableToOpen = nil } }
         ), actions: {
             TextField("Nombre", text: $clientName)
             Button("Abrir") {
                 if let t = tableToOpen {
                     let name = clientName
                     Task { try? await service.openTable(t, clientName: name) }
                 }
                 tableToOpen = nil
                 clientName = ""
             }
             Button("Cancelar", role: .cancel) {
                 tableToOpen = nil
                 clientName = ""
             }
         })
        .sheet(item: $tableForCuenta) { table in
            CuentaView(tableId: table.id, service: linesService)
                .onAppear {
                    linesService.startListening(tableNumber: table.number, companyId: companyId)
                }
                .onDisappear {
                    linesService.stopListening()
                }
        }
    }
    
    private func summary(for table: Table) -> TableOrderSummary? {
        if let s = service.tableOrderInfo[table.number] { return s }
        if let d = service.tablesAllDelivered[table.number] {
            return TableOrderSummary(worstStatus: .ready, lastUpdate: d)
        }
        if let d = service.clientSatAt[table.id] {
            return TableOrderSummary(worstStatus: .pending, lastUpdate: d)
        }
        return nil
    }
}

#Preview {
    WaiterView(companyId: "V628" )
}
