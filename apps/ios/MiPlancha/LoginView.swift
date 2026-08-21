//
//  LoginView.swift
//  MiPlancha
//
//  Created by julio on 21/08/2026.
//

import UIKit
import SwiftUI



struct LoginView: View {
    @State private var companyCode = ""
    @State private var username = ""
    @State private var password = ""
    
    var body: some View {
        VStack(spacing: 10) {
            TextField("Company Code", text: $companyCode)
                .textFieldStyle(RoundedBorderTextFieldStyle())
            TextField("Username", text: $username)
                .textFieldStyle(RoundedBorderTextFieldStyle())
            SecureField("Password", text: $password)
        }
    }
}
