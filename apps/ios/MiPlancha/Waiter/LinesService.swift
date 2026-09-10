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
    private(set) var tableOpenedAt: Date?
    private(set) var grillCapacity: Int?
    
    var orders: [Order] {
        Dictionary(grouping: lines, by: \.orderId)
            .map {Order(id:$0.key, lines: $0.value)}
    }
    
    func startListening(tableNumber: Int, companyId: String) {
        self.companyId = companyId
        self.tableNumber = tableNumber
        
        Task { self.products = await fetchProducts(companyId: companyId)}
        
        Task {
            let snapshot = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("config").document("plancha")
                .getDocument()
            self.grillCapacity = snapshot?.data()?["capacidadTotal"] as? Int
        }
        
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
                        self.tableOpenedAt = (doc?.data()?["abiertoEn"] as? Timestamp)?.dateValue()
                    } else {
                        self.clientName = nil
                        self.tableOpenedAt = nil
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
    
    func markLineDelivered(lineId: String) async throws {
        guard let ref =  refs[lineId] else { return }
        try await ref.updateData(["estado":LineStatus.ready.rawValue])
        try await ref.updateData(["listoEn" : FieldValue.serverTimestamp()])
    }
    
    func addOrder(lines: [(productId: String, amount: Int)]) async throws {
        if let capacity = grillCapacity {
            for line in lines {
                let needed = (products[line.productId]?.capacidadUnidad ?? 0) * line.amount
                if needed > capacity {
                    let name = products[line.productId]?.name ?? line.productId
                    throw LinesError.lineExceeedsGrillCapacity(productName: name)
                }
            }
        }
        
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
                "subgrupo": 1,
                "usandoOverflow": false,
                "mesaNumero": tableNumber,
                "empresaId": companyId,
                "pedidoCreadoEn": FieldValue.serverTimestamp()
            ])
        }
    }
    
    func openTable(tableId: String, clientName : String) async throws {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let db = Firestore.firestore()
        let tableRef = db
            .collection("empresas").document(companyId)
            .collection("mesas").document(tableId)
        let clientRef = db
            .collection("empresas").document(companyId)
            .collection("clientes").document()
        
        try await _ = db.runTransaction { trn, errPtr in
            let tableSnp: DocumentSnapshot
            do {
                tableSnp = try trn.getDocument(tableRef)
            } catch let err as NSError {
                errPtr?.pointee = err
                return nil
            }
            guard tableSnp.exists, (tableSnp.data()?["estado"] as? String) == "libre" else {
                errPtr?.pointee = NSError(domain: "TableError", code: 1, userInfo: [NSLocalizedDescriptionKey: "mesa-no-libre"])
                return nil
            }
            
            trn.setData([
                "camareroId" : uid,
                "mesaId" : tableId,
                "nombre" : clientName,
                "abiertoEn" : FieldValue.serverTimestamp()
            ], forDocument: clientRef)
            
            trn.updateData([
                "estado" : "ocupada",
                "clienteId" : clientRef.documentID
            ], forDocument: tableRef)
            
            return nil
        }
    }
    
    func fetchBillLines() async{
        var openedAt = tableOpenedAt
        if openedAt == nil, let cid = clientId {
            let doc = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("clientes").document(cid)
                .getDocument()
            openedAt = (doc?.data()?["abiertoEn"] as? Timestamp)?.dateValue()
        }
        guard let openedAt else {return}
        
        
        guard let snapshot = try? await Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("mesaNumero", isEqualTo: tableNumber)
            .whereField("empresaId", isEqualTo: companyId)
           .whereField("pedidoCreadoEn", isGreaterThanOrEqualTo: Timestamp(date: openedAt))
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
    
    private func linesForBill() -> (lineas: [[String:Any]], total: Double) {
        var total = 0.0
        let lineas : [[String : Any ]] = billLines.map { line in
            let precioUnidad = products[line.productId]?.price ?? 0
            let subtotal = precioUnidad * Double(line.amount)
            total += subtotal
            return [
                "pedidoId" : line.orderId,
                "productoNombre" : products[line.productId]?.name ?? line.productId,
                "cantidad" : line.amount,
                "precioUnidad" : precioUnidad,
                "subtotal" : subtotal
            ]
        }
        return (lineas, total)
    }
    
    func generateBill(tableId: String) async throws {
        guard let clientId = clientId, let uid = Auth.auth().currentUser?.uid else  { return }
        let clientRef = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("clientes").document(clientId)
        let tableRef = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("mesas").document(tableId)
        
        if billLines.isEmpty {
            try await _ = Firestore.firestore().runTransaction { transaction, errorPtr in
                let snap : DocumentSnapshot
                do {
                    snap = try transaction.getDocument(clientRef)
                } catch let err as NSError {
                    errorPtr?.pointee = err
                    return nil
                }
                guard snap.exists else {
                    errorPtr?.pointee = NSError(domain: "CuentaError", code: 1, userInfo: [NSLocalizedDescriptionKey: "cliente-ya-cerrado"])
                    return nil
                    
                }
                transaction.deleteDocument(clientRef)
                transaction.updateData([
                    "estado" : "libre",
                    "clienteId": NSNull()
                ], forDocument: tableRef)
                return nil
            }
            return
        }
        
        let (lines, total) = linesForBill()
        let orderIds = Array(Set(billLines.map(\.orderId)))
        let cuentaRef = Firestore.firestore()
            .collection("empresas").document(companyId)
            .collection("cuentas").document()
        
        try await _ = Firestore.firestore().runTransaction { trans, errPtr in
            let snapshot: DocumentSnapshot
            do {
                snapshot = try trans.getDocument(clientRef)
            } catch let err as NSError {
                errPtr?.pointee = err
                return nil
            }
            guard snapshot.exists else {
                errPtr?.pointee = NSError(domain: "CuentaError", code: 1, userInfo: [NSLocalizedDescriptionKey: "cliente-ya-cerrado"])
                return nil
            }
            trans.setData([
                "mesaNumero" : self.tableNumber,
                "clienteNombre" : self.clientName ?? "",
                "camareroId" : uid,
                "pedidoIds" : orderIds,
                "lineas" : lines,
                "total" : total,
                "generadaEn" : FieldValue.serverTimestamp()
            ], forDocument: cuentaRef)
            
            for pedidoId in orderIds {
                let pedidoRef = Firestore.firestore()
                    .collection("empresas").document(self.companyId)
                    .collection("pedidos").document(pedidoId)
                trans.updateData([
                    "cuentaId" : cuentaRef.documentID
                ], forDocument: pedidoRef)
            }
            
            trans.deleteDocument(clientRef)
            trans.updateData([
                "estado" : "libre",
                "clienteId" : NSNull()
            ], forDocument: tableRef)
            
            return nil
        }
    }
    
    func markOrderDelivered(orderId: String) async throws {
        let toDeliver = lines.filter { $0.orderId  == orderId && $0.status == .pendingDelivery }
        
        for line in toDeliver {
            guard let ref = refs[line.id] else { continue}
            try await ref.updateData(["estado": LineStatus.ready.rawValue])
            try await ref.updateData(["listoEn" : FieldValue.serverTimestamp()])
        }
    }
}

enum LinesError: Error {
    case lineExceeedsGrillCapacity(productName: String)
}
