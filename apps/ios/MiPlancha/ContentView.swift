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
            case .cocinero: RoleContainerView(usuario: usuario, onLogout: logout) {
                Text("Cocinero: \(usuario.name)")
            }
            case .camarero: RoleContainerView(usuario: usuario, onLogout: logout) {
                Text("Camarero: \(usuario.name)")
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
