//
//  TablesService.swift
//  MiPlancha
//
//  Created by julio on 25/08/2026.
//

import Observation
import FirebaseFirestore
import FirebaseAuth

@Observable
@MainActor
final class TablesService {
    private var listener: ListenerRegistration?
    private(set) var tables: [Table] = []
    private var companyId = ""
    
    func startListening(companyId: String) {
        self.companyId = companyId
        
        listener = Firestore.firestore()
            .collection("empresas").document(companyId).collection("mesas")
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let docs = snapshot?.documents else { return }
                let parsed = docs.compactMap { doc -> Table? in
                    let data = doc.data()
                    guard let number = data["numero"] as? Int,
                          let statusRaw = data["estado"] as? String,
                          let status = TableStatus(rawValue: statusRaw)
                    else { return nil }
                    return Table(id: doc.documentID, number: number, status: status)
                }
                Task { @MainActor [weak self] in
                    self?.tables = parsed
                }
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
    
    func openTable(_ table: Table, clientName: String) async throws {
        guard let uid = Auth.auth().currentUser?.uid else {return}
        
        let db = Firestore.firestore()
        let clientRef = db.collection("empresas").document( companyId)
            .collection("clientes").document()
        
        try await clientRef.setData([
            "camareroId": uid,
            "mesaId": table.id,
            "nombre": clientName,
            "abiertoEn": FieldValue.serverTimestamp()
        ])
        
        try await db.collection("empresas").document(companyId)
            .collection("mesas").document(table.id)
            .updateData(["estado": "ocupada", "clienteId": clientRef.documentID])
        
        
    }
    
    func closeTable(_ table: Table) async throws {
        try await Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("mesas").document(table.id)
            .updateData(["estado": "libre", "clienteId": NSNull()])
    }
}
