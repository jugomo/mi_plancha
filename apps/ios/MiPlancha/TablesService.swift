//
//  TablesService.swift
//  MiPlancha
//
//  Created by julio on 25/08/2026.
//

import Observation
import FirebaseFirestore

@Observable
@MainActor
final class TablesService {
    private var listener: ListenerRegistration?
    private(set) var tables: [Table] = []
    
    func startListening(companyId: String) {
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
}
