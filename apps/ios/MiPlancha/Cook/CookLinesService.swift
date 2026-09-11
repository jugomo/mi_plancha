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
    private(set) var maxWaitSeconds: Int = 900
    private(set) var thresoldDivision: Int = 8
    private(set) var subgroupSize: Int = 4
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
            let snapPlancha = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("config").document("plancha")
                .getDocument()
            self.grillCapacity = snapPlancha?.data()?["capacidadTotal"] as? Int
        }
        
        Task {
            let snapDivision = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("config").document("division")
                .getDocument()
            self.thresoldDivision = snapDivision?.data()?["umbral"] as? Int ?? 8
            self.subgroupSize = snapDivision?.data()?["tamanoSubgrupo"] as? Int ?? 4
        }

        Task {
            let snapAntiinanicion = try? await Firestore.firestore()
                .collection("empresas").document(companyId)
                .collection("config").document("antiInanicion")
                .getDocument()
            let minutos  = snapAntiinanicion?.data()?["tiempoMaximoEsperaMin"] as? Int ?? 15
            self.maxWaitSeconds = minutos * 60
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
    
    func takeOrder(orderId: String, userId: String) async  throws{
        let pedidoRef = Firestore.firestore()
            .collection("empresas").document(self.companyId)
            .collection("pedidos").document(orderId)
        
        let _ = try await Firestore.firestore().runTransaction { transaction, errorPointer in
            let snap: DocumentSnapshot
            
            do{
                snap = try transaction.getDocument(pedidoRef)
            } catch let err as NSError {
                errorPointer?.pointee = err
                return nil
            }
            
            let cocineroActual = snap.data()?["cocineroId"] as? String
            if cocineroActual == nil {
                transaction.updateData(["cocineroId":userId], forDocument: pedidoRef)
            } else if cocineroActual != userId {
                errorPointer?.pointee = NSError(domain: "CookError", code: 1, userInfo: [NSLocalizedDescriptionKey: "pedido-ya-tomado"])
                return nil
            }
            
            return nil
        }
    }
    
    func putInGrill(lineId: String, allowOverflow: Bool) async throws {
        guard let ref = refs[lineId] else { return }
        var willUseOverflow = false
        
//        let inUse = lines
//            .filter{$0.status == .cooking }
//            .reduce(0) { sum, line in
//                sum + (products[line.productId]?.capacidadUnidad ?? 0) * line.amount
//            }
        let cookingSnap = try await Firestore.firestore()
            .collectionGroup("lineas")
            .whereField("empresaId", isEqualTo: companyId)
            .whereField("estado", isEqualTo: LineStatus.cooking.rawValue)
            .getDocuments()
        
        let inUse = cookingSnap.documents.reduce(0) { sum, doc in
            let data = doc.data()
            let productId = data["productoId"] as? String ?? ""
            let amount = data["cantidad"] as? Int ?? 0
            return sum + (products[productId]?.capacidadUnidad ?? 0) * amount
        }
        
        let targetLine = lines.first {$0.id == lineId}
        let needed = (products[lines.first {$0.id == lineId}?.productId ?? "" ]?.capacidadUnidad ?? 0) * (targetLine?.amount ?? 0)
        
        
        guard let base = grillCapacity else { return}
        var capacidad: Int
        if overflowManualActive || allowOverflow, let pct = overflowPercent {
            capacidad = Int(Double(base) * (1 + Double(pct) / 100))
        } else {
            capacidad = base
        }
        guard inUse  + needed <= capacidad else {
            throw CookError.fullGrill
        }
        if inUse + needed > base {
            willUseOverflow = true
        }
    
        let _ = try await Firestore.firestore().runTransaction { transaction, errorPointer in
            let productId = targetLine?.productId ?? ""
            let amount = targetLine?.amount ?? 0
            let productRef = Firestore.firestore()
                .collection("empresas").document(self.companyId)
                .collection("productos").document(productId)
            
            let productSnap: DocumentSnapshot
            do {
                productSnap = try transaction.getDocument(productRef)
            } catch let err as NSError {
                errorPointer?.pointee = err
                return nil
            }
            let stockActual = productSnap.data()?["stock"] as? Int ?? 0
            guard stockActual >= amount else {
               errorPointer?.pointee = NSError(domain: "CookError", code: 2,
                   userInfo: [NSLocalizedDescriptionKey: "stock-insuficiente"])
               return nil
            }
            
            var datosLinea: [String: Any] = [
                "estado": LineStatus.cooking.rawValue,
                "colocadoEn": FieldValue.serverTimestamp()
            ]
            if willUseOverflow { datosLinea["usandoOverflow"] = true }
            transaction.updateData(datosLinea, forDocument: ref)
            transaction.updateData(["stock": stockActual - amount], forDocument: productRef)
            
            return nil
        }
    }
    
    func takeFromGrill(lineId: String) async throws {
        guard let ref = refs[lineId] else { return }
        try await ref.updateData([
            "estado": LineStatus.pendingDelivery.rawValue,
            "retiradoEn": FieldValue.serverTimestamp()
        ])
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
