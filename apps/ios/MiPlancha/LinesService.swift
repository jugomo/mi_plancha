//
//  LinesService.swift
//  MiPlancha
//
//  Created by julio on 26/08/2026.
//

import Observation
import FirebaseFirestore

@Observable
@MainActor
final class LinesService {
    private(set) var lines: [OrderLine] = []
    private var listener: ListenerRegistration?
    
    func startListening(tableNumber: Int) {
        listener = Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("mesaNumero", isEqualTo: tableNumber)
            .addSnapshotListener { snapshot, error in
                guard let docs = snapshot?.documents else { return }
                let parsed = docs.compactMap { doc -> OrderLine? in
                    let data = doc.data()
                    guard let amount = data["cantidad"] as? Int,
                          let rawStatus = data["estado"] as? String,
                          let status = LineStatus(rawValue: rawStatus),
                          let productId = data["productoId"] as? String
                    else { return nil }
                    return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId)
                    
                }
                Task { @MainActor [weak self] in
                    self?.lines = parsed
                }
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
}
