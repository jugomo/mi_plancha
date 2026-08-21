//
//  AuthService.swift
//  MiPlancha
//
//  Login methods.
//
//  Created by julio on 21/08/2026.
//

import Observation
import FirebaseAuth

/// Service to manage authentication
///
/// MainActor: Indicates that all methods here will run in the main thread. This is necessary at any observable object which touches the UI.
///
@Observable
@MainActor
final class AuthService {
    private(set) var user: User?
    
    init() {
        user = Auth.auth().currentUser
    }
    
    func initSession(companyCode: String, username: String, password: String) async throws {
        let mail = UsernameEmail.syntheticEmail(companyCode: companyCode, username: username)
        let result = try await Auth.auth().signIn(withEmail: mail, password: password)
        self.user = result.user
    }
    
    func logout() throws {
        try Auth.auth().signOut()
        user = nil
    }
}
