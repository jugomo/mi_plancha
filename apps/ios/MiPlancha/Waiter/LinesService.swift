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
    private var listenerLine: ListenerRegistration?
    private var listenerMesa: ListenerRegistration?
    private var refs: [String: DocumentReference] = [:]
    private(set) var products : [String : ProductInfo] = [:]
    private var companyId = ""
     var tableNumber = 0
    private(set) var tableStatus: TableStatus = .libre
    private(set) var billLines: [OrderLine] = []
     var clientId: String?
     var clientName: String?
    
    var orders: [Order] {
        Dictionary(grouping: lines, by: \.orderId)
            .map {Order(id:$0.key, lines: $0.value)}
    }
    
    func startListening(tableNumber: Int, companyId: String) {
        self.companyId = companyId
        self.tableNumber = tableNumber
        
        Task { self.products = await fetchProducts(companyId: companyId)}
        
        listenerLine = Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("mesaNumero", isEqualTo: tableNumber)
            .whereField("empresaId", isEqualTo: companyId)
            .whereField("estado", isNotEqualTo: LineStatus.ready.rawValue)
            .addSnapshotListener { snapshot, error in
                if let error = error {
                    print("ERROR: \(error)")
                }
                guard let docs = snapshot?.documents else {
                    return
                }
                let parsed = docs.compactMap { doc -> OrderLine? in
                    let data = doc.data()
                    guard let amount = data["cantidad"] as? Int,
                          let rawStatus = data["estado"] as? String,
                          let status = LineStatus(rawValue: rawStatus),
                          let productId = data["productoId"] as? String,
                          let tableNumber = data["mesaNumero"] as? Int,
                          let createdAt = (data["pedidoCreadoEn"] as? Timestamp)?.dateValue()
                    else { return nil }
                    let orderId = doc.reference.parent.parent?.documentID ?? ""
                    
                    return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId, tableNumber: tableNumber, orderId: orderId, createdAt: createdAt)
                    
                }
                let newRefs = Dictionary(uniqueKeysWithValues: docs.map { ($0.documentID, $0.reference)} )
                Task { @MainActor [weak self] in
                    self?.lines = parsed
                    self?.refs = newRefs
                }
            }
        
        listenerMesa = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("mesas").document(String(tableNumber))  // el id es el numero como string
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self,
                      let data = snapshot?.data(),
                      let raw = data["estado"] as? String,
                      let status = TableStatus(rawValue: raw) else { return }
                
                let clienteId = data["clienteId"] as? String
                
                Task { @MainActor [weak self] in
                    guard let self else {return}
                    
                    self.tableStatus = status
                    self.clientId = clienteId
                    
                    if let clienteId {
                        let doc = try? await Firestore.firestore()
                            .collection("empresas").document(self.companyId)
                            .collection("clientes").document(clienteId)
                            .getDocument()
                        self.clientName = doc?.data()?["nombre"] as? String
                    } else {
                        self.clientName = nil
                    }
                }
            }
        
    }
    
    func stopListening() {
        listenerLine?.remove()
        listenerLine = nil
        
        listenerMesa?.remove()
        listenerMesa = nil
    }
    
    func markDelivered(lineId: String) async throws {
        guard let ref =  refs[lineId] else { return }
        try await ref.updateData(["estado":LineStatus.ready.rawValue])
    }
    
    func addOrder(lines: [(productId: String, amount: Int)]) async throws {
        let pedidoRef = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("pedidos").document()
        
        guard let uid = Auth.auth().currentUser?.uid else { return }
        
        try await pedidoRef.setData([
            "mesaNumero": tableNumber,
            "empresaId": companyId,
            "camareroId": uid,
            "cocineroId":NSNull(),
            "cuentaId": NSNull(),
            "creadoEn": FieldValue.serverTimestamp(),
            "clienteId": clientId ?? NSNull(),
            "clienteNombre": clientName ?? NSNull()
        ])
        
        for line in lines {
            try await pedidoRef.collection("lineas").addDocument(data: [
                "productoId": line.productId,
                "cantidad": line.amount,
                "estado": LineStatus.pending.rawValue,
                "mesaNumero": tableNumber,
                "empresaId": companyId,
                "pedidoCreadoEn": FieldValue.serverTimestamp()
            ])
        }
    }
    
    func openTable(tableId: String, clientName: String) async throws {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let db = Firestore.firestore()
        let clientRef = db.collection("empresas").document(companyId)
            .collection("clientes").document()
        try await clientRef.setData(["camareroId": uid, "mesaId": tableId,
                                     "nombre": clientName, "abiertoEn": FieldValue.serverTimestamp()])
        try await db.collection("empresas").document(companyId)
            .collection("mesas").document(tableId)
            .updateData(["estado": "ocupada", "clienteId": clientRef.documentID])
    }
    
    func closeTable(tableId: String) async throws {
        try await Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("mesas").document(tableId)
            .updateData(["estado": "libre", "clienteId": NSNull()])
    }
    
    func fetchBillLines() async{
        guard let snapshot = try? await Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("mesaNumero", isEqualTo: tableNumber)
            .whereField("empresaId", isEqualTo: companyId)
            .getDocuments()
        else { return }
        
        billLines = snapshot.documents.compactMap { doc -> OrderLine? in
            let data = doc.data()
            guard let amount = data["cantidad"] as? Int,
                  let rawStatus = data["estado"] as? String,
                  let status = LineStatus(rawValue: rawStatus),
                  let productId = data["productoId"] as? String,
                  let tableNumber = data["mesaNumero"] as? Int,
                  let createdAt = (data["pedidoCreadoEn"] as? Timestamp)?.dateValue()
            else { return nil }
            let orderId = doc.reference.parent.parent?.documentID ?? ""
            
            return OrderLine(id: doc.documentID, amount: amount, status: status, productId: productId, tableNumber: tableNumber, orderId: orderId, createdAt: createdAt)
        }
        
    }
    
    func markOrderDelivered(orderId: String) async throws {
        let toDeliver = lines.filter { $0.orderId  == orderId && $0.status == .pendingDelivery }
        
        for line in toDeliver {
            guard let ref = refs[line.id] else { continue}
            try await ref.updateData(["estado": LineStatus.ready.rawValue])
        }
    }
}
