//
//  Usuario.swift
//  MiPlancha
//
//  Created by julio on 24/08/2026.
//

enum Rol: String {
    case camarero, cocinero, administrador, superadmin
}

struct Usuario {
    var uid: String
    var name: String
    var rol: Rol
    var companyId: String? // superadmin not having company
}

enum TableStatus: String {
    case libre, ocupada, cobrar
}

struct Table: Identifiable {
    let id: String
    var number: Int
    var status: TableStatus
}
