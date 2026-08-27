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
    
    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(service.tables) { table in
                    NavigationLink(destination: TableDetailView(table: table, companyId: companyId )) {
                        TableCardView(table: table)
                    }
                }
            }.padding()
        }
        .onAppear {
            
             service.startListening(companyId: companyId)
        }
        .onDisappear {
            service.stopListening()
        }
    }
}

#Preview {
    WaiterView(companyId: "V628")
}
