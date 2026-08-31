import SwiftUI
import FirebaseCore

struct ContentView: View {
    let auth: AuthService
    
    
    var body: some View {
        if auth.isRestoringSession {
            ProgressView()
        } else if let usuario = auth.usuario {
            let logout = { _ = try? auth.logout() }
            
            switch usuario.rol {
            case .superadmin: RoleContainerView(usuario: usuario, onLogout: logout) {
                Text("Superadmin: \(usuario.name)")
            }
            case .administrador: RoleContainerView(usuario: usuario, onLogout: logout) {
                Text("Admin: \(usuario.name)")
            }
            case .cocinero:
                if let companyId = usuario.companyId {
                    RoleContainerView(usuario: usuario, onLogout: logout) {
                        CookView(companyId: companyId)
                    }
                }
            
            case .camarero:
                if let companyId = usuario.companyId {
                    RoleContainerView(usuario: usuario, onLogout: logout) {
                        WaiterView(companyId: companyId)
                    }
                }
            }
        } else {
            LoginView { company, username, password in
                try await auth.initSession(companyCode: company, username: username, password: password)
            }
        }
    }
}

#Preview {
    if FirebaseApp.app() == nil {
        FirebaseApp.configure()
    }
    return ContentView(auth: AuthService())
    
}
