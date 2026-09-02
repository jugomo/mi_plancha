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
    private(set) var products: [String: ProductInfo] = [:]
    private(set) var capacidadPlancha = 0
    private var refs: [String : DocumentReference] = [:]
    private var listener: ListenerRegistration?
    
    
    func startListening(companyId: String) {
        Task {
            let snap = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("config").document("plancha")
                .getDocument()
            
            self.capacidadPlancha = snap?.data()?["capacidadTotal"] as? Int ?? 0
            print("self.capacidadTotal::: \(self.capacidadPlancha)")
        }

        Task {
            self.products = await fetchProducts(companyId: companyId)
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
                    let orderId = doc.reference.parent.parent?.documentID ?? ""
                    
                    return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId, tableNumber: mesaNumero, orderId: orderId)
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
        
        if currentStatus == .pending {
            //  sum capacidad of current products in the grill
            let inUse = lines
                .filter{$0.status == .cooking }
                .reduce(0) { sum, line in
                    sum + (products[line.productId]?.capacidadUnidad ?? 0) * line.amount
                }
            let targetLine = lines.first {$0.id == lineId}
            let needed = (products[lines.first {$0.id == lineId}?.productId ?? "" ]?.capacidadUnidad ?? 0) * (targetLine?.amount ?? 0)
            
            guard inUse  + needed <= capacidadPlancha else {
                throw CookError.fullGrill
            }
        }
        
        let nextStatus: LineStatus = currentStatus == .pending ? .cooking : .pendingDelivery
        try await ref.updateData(["estado": nextStatus.rawValue])
        if currentStatus == .pending {
            try await ref.updateData(["colocadoEn": FieldValue.serverTimestamp()])
        }
    }
}

enum CookError: Error {
    case fullGrill
}
