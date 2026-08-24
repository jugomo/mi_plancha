import SwiftUI
import FirebaseCore

struct ContentView: View {
    let auth: AuthService
    
    var body: some View {
        if let usuario = auth.usuario {
            switch usuario.rol {
            case .superadmin: Text("Superadmin: \(usuario.name)")
            case .administrador: Text("Admin: \(usuario.name)")
            case .cocinero: Text("Cocinero: \(usuario.name)")
            case .camarero: Text("Camarero: \(usuario.name)")
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
