//
//  UsernameEmail.swift
//  MiPlancha
//
//  Authentication tools.
//
//  Created by julio on 21/08/2026.
//

private let domain = "miplancha.local"

enum UsernameEmail {


    static func normalize(_ username: String) -> String {
        return username.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func syntheticEmail(companyCode: String, username: String) -> String {
        return "\(normalize(username))@\(normalize(companyCode)).\(domain)"
    }

}

