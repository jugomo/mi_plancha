//
//  Usuario.swift
//  MiPlancha
//
//  Created by julio on 24/08/2026.
//

import SwiftUI

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
    var clientId: String?
}

enum LineStatus: String {
    case pending = "pendiente"
    case cooking = "en_plancha"
    case pedingDelivery = "pendiente_entrega"
    case ready = "listo"

    var color: Color {
        switch self {
        case .pending:         return .yellow
        case .cooking:         return .orange
        case .pedingDelivery:  return .blue
        case .ready:           return .green
        }
    }

    var label: String {
        switch self {
        case .pending:         return "Pendiente"
        case .cooking:         return "En plancha"
        case .pedingDelivery:  return "Para entregar"
        case .ready:           return "Entregado"
        }
    }
}

struct OrderLine: Identifiable {
    let id: String
    let amount: Int
    var status: LineStatus
    var productId: String
    var tableNumber: Int
}
