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
import FirebaseFirestore

/// Service to manage authentication
///
/// MainActor: Indicates that all methods here will run in the main thread. This is necessary at any observable object which touches the UI.
///
@Observable
@MainActor
final class AuthService {
    private(set) var user: User?
    private(set) var usuario: Usuario?
    
    init() {
        user = Auth.auth().currentUser
    }
    
    func initSession(companyCode: String, username: String, password: String) async throws {
        let mail = UsernameEmail.syntheticEmail(companyCode: companyCode, username: username)
        let result = try await Auth.auth().signIn(withEmail: mail, password: password)
        self.user = result.user
        self.usuario = try await fetchUser(uid: result.user.uid)
    }
    
    func logout() throws {
        try Auth.auth().signOut()
        user = nil
        usuario = nil
    }
    
    private func fetchUser(uid: String) async throws -> Usuario {
        let snap = try await Firestore.firestore().collection("usuarios").document(uid).getDocument()
        guard let data = snap.data(),
              let name = data["nombre"] as? String,
              let rolRaw = data["rol"] as? String,
              let rol = Rol(rawValue: rolRaw)
        else { throw AuthError.invalidData }
        
        let companyId = data["empresaId"] as? String
        
        return Usuario(uid: uid, name: name, rol: rol, companyId: companyId)
    }
}

enum AuthError: Error {
    case invalidData
}
