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
    private(set) var clientNames: [String : String] = [:]
    
    func startListening(companyId: String) {
        self.companyId = companyId
        
        listener = Firestore.firestore()
            .collection("empresas").document(companyId).collection("mesas")
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let docs = snapshot?.documents else { return }
                let parsed = docs.compactMap { doc -> Table? in
                    let data = doc.data()
                    let clienteId = data["clienteId"] as? String
                    guard let number = data["numero"] as? Int,
                          let statusRaw = data["estado"] as? String,
                          let status = TableStatus(rawValue: statusRaw)
                    else { return nil }
                    return Table(id: doc.documentID, number: number, status: status, clientId: clienteId)
                }
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.tables = parsed
                    
                    for table in parsed {
                        guard let clientId = table.clientId,
                              self.clientNames[table.id] == nil else {continue}
                        
                        let doc = try? await Firestore.firestore()
                            .collection("empresas").document(self.companyId)
                            .collection("clientes").document(clientId)
                            .getDocument()
                        
                        if let name = doc?.data()?["nombre"] as? String{
                            self.clientNames[table.id] = name
                        }
                    }
                    
                    let occupiedIds = Set(parsed.filter { $0.status == .ocupada }.map { $0.id })
                    clientNames = clientNames.filter { occupiedIds.contains($0.key) }
                    print("clientNames: \(clientNames)")
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
