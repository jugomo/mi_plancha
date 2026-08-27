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
    private var refs: [String: DocumentReference] = [:]
    
    func startListening(tableNumber: Int, companyId: String) {
        print("tableNumber: \(tableNumber)")
        
        listener = Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("mesaNumero", isEqualTo: tableNumber)
            .whereField("empresaId", isEqualTo: companyId)
            .whereField("estado", isNotEqualTo: LineStatus.ready.rawValue)
            .addSnapshotListener { snapshot, error in
                if let error = error {
                    print("ERROR: \(error)")
                }
                guard let docs = snapshot?.documents else {
                    print("no results")
                    return
                }
                let parsed = docs.compactMap { doc -> OrderLine? in
                    let data = doc.data()
                    print("linea data: \(data)")  // ← añade esta línea
                    guard let amount = data["cantidad"] as? Int,
                          let rawStatus = data["estado"] as? String,
                          let status = LineStatus(rawValue: rawStatus),
                          let productId = data["productoId"] as? String
                    else { return nil }
                    return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId)
                    
                }
                let newRefs = Dictionary(uniqueKeysWithValues: docs.map { ($0.documentID, $0.reference)} )
                Task { @MainActor [weak self] in
                    self?.lines = parsed
                    self?.refs = newRefs
                }
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
    
    func markDelivered(lineId: String) async throws {
        guard let ref =  refs[lineId] else { return }
        try await ref.updateData(["estado":LineStatus.ready.rawValue])
    }
}
