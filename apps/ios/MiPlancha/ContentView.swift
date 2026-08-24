import SwiftUI
import FirebaseCore

struct ContentView: View {
    let auth: AuthService
    
    var body: some View {
        if auth.user != nil {
            Text("bienvenido")
                .padding()
            
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
