//
//  Untitled.swift
//  MiPlancha
//
//  Created by julio on 25/08/2026.
//

import SwiftUI

struct WaiterView: View {
    let user: Usuario
    let columns = [GridItem(.adaptive(minimum: 120))]
    @State private var service = TablesService()
    
    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(service.tables) { table in
                    NavigationLink(destination: TableDetailView(table: table)) {
                        TableCardView(table: table)
                    }
                }
            }.padding()
        }
        .onAppear {
            guard let companyId = user.companyId else {
                return
            }
            service.startListening(companyId: companyId)
        }
        .onDisappear {
            service.stopListening()
        }
    }
}

#Preview {
    WaiterView(user: Usuario(uid: "123", name: "yosi", rol: .camarero ))
}
