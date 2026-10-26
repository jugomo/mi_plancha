//
//  OrderSummary.swift
//  MiPlancha
//
//  Created by julio on 22/10/2026.
//

import FirebaseFirestore

struct OrderSummary: Identifiable {
    var id: String
    var tableNumber: Int
    var clientName: String
    var billId: String?
    var createdAt: Date
    
    init?(doc: QueryDocumentSnapshot) {
        let dict = doc.data()
        
        guard let tableNumber = dict["mesaNumero"] as? Int,
              let clientName = dict["clienteNombre"] as? String,
              let timestamp = dict["creadoEn"] as? Timestamp
        else { return nil }
        
        self.id = doc.documentID
        self.tableNumber = tableNumber
        self.clientName = clientName
        self.billId = dict["cuentaId"] as? String
        self.createdAt = timestamp.dateValue()
        
        
    }
}
