//
//  CompletedOrdersService.swift
//  MiPlancha
//
//  Created by julio on 22/10/2026.
//

import Observation
import FirebaseFirestore

@Observable
@MainActor
class CompletedOrdersService {
    private(set) var orders: [OrderSummary]?
    private(set) var lines: [OrderLine]?
    private var companyId: String?
    
    private var listenerPedidos: ListenerRegistration?
    private var listenerLineas: ListenerRegistration?
    
    func startListening(companyId: String, field: String, userId: String) {
        self.companyId = companyId
        
        listenerPedidos = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("pedidos")
            .whereField(field, isEqualTo: userId)
            .addSnapshotListener { snapshot, error in
                if let error = error { print("ERROR: \(error)"); return }
                guard let docs = snapshot?.documents else { return }
                
                let parsed =  docs.compactMap(OrderSummary.init)
                
                Task { @MainActor [weak self] in
                    self?.orders = parsed
                }
            }
        
        listenerLineas = Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("empresaId", isEqualTo: companyId)
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
                
                Task { @MainActor [weak self] in
                    self?.lines = parsed
                }
            }
    }
    
    func stopListening() {
        listenerPedidos?.remove()
        listenerPedidos = nil
        
        listenerLineas?.remove()
        listenerLineas = nil
    }
    
    var completed: [OrderSummary] {
        let byOrder = Dictionary(grouping: lines ?? [], by: \.orderId)
        
        let completedIds = Set (
            byOrder
                .filter { $0.value.allSatisfy { $0.status == .ready } }
                .keys
        )
        
        return (orders ?? []).filter {  completedIds.contains($0.id) }
            .sorted { $0.createdAt > $1.createdAt }
    }
    
    func deleteOrder(orderId: String) async throws {
        guard let companyId else { return }
            
        let orderRef = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("pedidos").document(orderId)
            
        let linesRef = orderRef.collection("lineas")
        let snapshot = try await linesRef.getDocuments()
            
        let batch = Firestore.firestore().batch()
        snapshot.documents.forEach { doc in
            batch.deleteDocument(doc.reference)
        }
        
        batch.deleteDocument(orderRef)
        try await batch.commit()
        
    }
}
