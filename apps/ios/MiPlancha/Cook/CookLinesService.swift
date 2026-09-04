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
    private(set) var grillCapacity: Int?
    private var refs: [String : DocumentReference] = [:]
    private var listener: ListenerRegistration?
    private(set) var overflowPercent: Int?
    private(set) var overflowManualActive = false
    private var listenerStatus: ListenerRegistration?
    private var companyId = ""
    
    var efectiveCapacity: Int? {
        guard let base = grillCapacity else {
            return nil
        }
        guard overflowManualActive, let pct = overflowPercent else {
            return base
        }
        return Int(Double(base) * (1 + Double(pct) / 100))
    }
    
    func startListening(companyId: String) {
        self.companyId = companyId
        
        Task {
            let snap = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("config").document("plancha")
                .getDocument()
            
            self.grillCapacity = snap?.data()?["capacidadTotal"] as? Int
            print("self.capacidadTotal::: \(self.grillCapacity)")
        }

        Task {
            self.products = await fetchProducts(companyId: companyId)
        }
        
        Task {
            let snap = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("config").document("overflow").getDocument()
            self.overflowPercent = snap?.data()?["porcentaje"] as? Int
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
                          let mesaNumero = data["mesaNumero"] as? Int,
                          let createdAt = (data["pedidoCreadoEn"] as? Timestamp)?.dateValue()
                    else { return nil }
                    let cookedAt = (data["colocadoEn"] as? Timestamp)?.dateValue()
                    let orderId = doc.reference.parent.parent?.documentID ?? ""
                    
                    return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId, tableNumber: mesaNumero, orderId: orderId, createdAt:createdAt, cookedAt: cookedAt)
                }
                let newRefs = Dictionary(uniqueKeysWithValues: docs.map { ($0.documentID, $0.reference) })
                Task { @MainActor [weak self] in
                    self?.lines = parsed
                    self?.refs = newRefs
                }
            }
        
        listenerStatus = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("plancha").document("estado")
            .addSnapshotListener { snap,_ in
                Task { @MainActor [weak self] in
                    self?.overflowManualActive = snap?.data()?["overflowManualActivo"] as? Bool ?? false
                }
                
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
        
        listenerStatus?.remove()
        listenerStatus = nil
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
            
            guard let capacidad = efectiveCapacity else { return}
            guard inUse  + needed <= capacidad else {
                throw CookError.fullGrill
            }
        }
        
        let nextStatus: LineStatus = currentStatus == .pending ? .cooking : .pendingDelivery
        try await ref.updateData(["estado": nextStatus.rawValue])
        if currentStatus == .pending {
            try await ref.updateData(["colocadoEn": FieldValue.serverTimestamp()])
        }
    }
    
    func toggleOverflow(uid: String) async throws {
        let newPercent = !overflowManualActive
        try await Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("plancha").document("estado")
            .setData([
                    "overflowManualActivo": newPercent,
                    "activadoPor": uid,
                    "activadoEn": FieldValue.serverTimestamp()
            ], merge: true)
    }
}

enum CookError: Error {
    case fullGrill
}
