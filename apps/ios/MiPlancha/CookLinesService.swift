//
//  CookLinesService.swift
//  MiPlancha
//
//  Created by julio on 27/08/2026.
//

import Observation
import FirebaseFirestore

@Observable
@MainActor
final class CookLinesService {
    private(set) var lines: [OrderLine] = []
    private(set) var productNames: [String: String] = [:]
    private var refs: [String : DocumentReference] = [:]
    private var listener: ListenerRegistration?
    
    
    func startListening(companyId: String) {
        Task {
            self.productNames = await fetchProductNames(companyId: companyId)
        }
        
        listener = Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("empresaId", isEqualTo: companyId)
            .whereField("estado", in: [LineStatus.pending.rawValue, LineStatus.cooking.rawValue])
            .addSnapshotListener { snapshot, error in
                if let error = error { print("ERROR: \(error)"); return }
                guard let docs = snapshot?.documents else { return }
                let parsed = docs.compactMap { doc -> OrderLine? in
                    let data = doc.data()
                    guard let amount = data["cantidad"] as? Int,
                          let rawStatus = data["estado"] as? String,
                          let status = LineStatus(rawValue: rawStatus),
                          let productId = data["productoId"] as? String,
                          let mesaNumero = data["mesaNumero"] as? Int
                    else { return nil }
                    return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId, tableNumber: mesaNumero)
                }
                let newRefs = Dictionary(uniqueKeysWithValues: docs.map { ($0.documentID, $0.reference) })
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

    func advance(lineId: String, currentStatus: LineStatus) async throws {
        guard let ref = refs[lineId] else { return }
        let nextStatus: LineStatus = currentStatus == .pending ? .cooking : .pedingDelivery
        try await ref.updateData(["estado": nextStatus.rawValue])
        try await ref.updateData(["colocadoEn": FieldValue.serverTimestamp()])
    }
}
