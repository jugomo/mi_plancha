//
//  RoleContainerView.swift
//  MiPlancha
//
//  Created by julio on 25/08/2026.
//

import SwiftUI

struct RoleContainerView<Content: View>: View {
    let usuario: Usuario
    let onLogout: () -> Void
    @ViewBuilder let content: () -> Content
    
    var body: some View {
        NavigationStack {
            content().toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Text(usuario.name).fontWeight(.semibold)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Salir", action: onLogout)
                }
            }
        }
    }
}


#Preview {
    RoleContainerView(
        usuario: Usuario(uid: "1234.", name: "julio", rol: .camarero),
        onLogout: {}) {
        Text("contenido del rol")
    }
}
