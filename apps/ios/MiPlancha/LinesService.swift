//
//  LinesService.swift
//  MiPlancha
//
//  Created by julio on 26/08/2026.
//

import Observation
import FirebaseFirestore
import FirebaseAuth

@Observable
@MainActor
final class LinesService {
    private(set) var lines: [OrderLine] = []
    private var listener: ListenerRegistration?
    private var refs: [String: DocumentReference] = [:]
    private(set) var productNames : [String : String] = [:]
    private var companyId = ""
    private var tableNumber = 0
    
    func startListening(tableNumber: Int, companyId: String) {
        self.companyId = companyId
        self.tableNumber = tableNumber
        
        // fetch product nmaes
        Task { self.productNames = await      fetchProductNames(companyId: companyId)}
        
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
                          let productId = data["productoId"] as? String,
                            let tableNumber = data["mesaNumero"] as? Int
                    else { return nil }
                    return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId, tableNumber: tableNumber)
                    
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
    
    func addLine(productId: String, amount: Int) async throws {
        let pedidoRef = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("pedidos").document()
        
        guard let uid = Auth.auth().currentUser?.uid else { return }
        
        try await pedidoRef.setData([
            "mesaNumero": tableNumber,
            "empresaId": companyId,
            "camareroId": uid,
            "cocineroId":NSNull(),
            "cuentaId": NSNull()
        ])
        try await pedidoRef.collection("lineas").addDocument(data: [
            "productoId": productId,
            "cantidad": amount,
            "estado": LineStatus.pending.rawValue,
            "mesaNumero": tableNumber,
            "empresaId": companyId
        ])
    }
}
