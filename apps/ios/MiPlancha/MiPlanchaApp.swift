import SwiftUI
import FirebaseCore

@main
struct MiPlanchaApp: App {
    init() {
        FirebaseApp.configure()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
