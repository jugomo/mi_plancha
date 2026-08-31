//
//  LoginView.swift
//  MiPlancha
//
//  Created by julio on 21/08/2026.
//

import SwiftUI

struct LoginView: View {
    @State private var companyCode = ""
    @State private var username = ""
    @State private var password = ""
    @State private var errorMessage: String?
    
    let onLogin: (String, String, String) async throws -> Void
    
    
    
    var body: some View {
        
        VStack(spacing: 24) {
            Text("plancha").font(.largeTitle).bold()
            
            VStack(spacing: 12) {
                /* FORM FIELDS */
                TextField("Company Code", text: $companyCode)
                    .textFieldStyle(.roundedBorder)
                TextField("Username", text: $username)
                    .textFieldStyle(.roundedBorder)
                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                
                /* SUBMIT BUTTON */
                Button("Entrar") {
                    Task {
                        do {
                            try await onLogin(companyCode, username, password)
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .disabled(companyCode.isEmpty || username.isEmpty || password.isEmpty)
                
                /* ERROR MESSAGE */
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }.padding(32)
        }
    }
    
    
    
}

#Preview {
    LoginView { _, _, _ in }
}
