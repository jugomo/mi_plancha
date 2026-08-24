import SwiftUI
import FirebaseCore

@main
struct MiPlanchaApp: App {
    @State private var auth: AuthService

    init() {
        FirebaseApp.configure()
        _auth = State(initialValue: AuthService())
    }

    var body: some Scene {
        WindowGroup {
            ContentView(auth: auth)
        }
    }
}
