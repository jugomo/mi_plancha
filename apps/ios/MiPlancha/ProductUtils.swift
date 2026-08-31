//
//  ProductUtils.swift
//  MiPlancha
//
//  Created by julio on 28/08/2026.
//


import FirebaseFirestore

struct ProductInfo {
    let name: String
    let price: Double
    let stock: Int
    let capacidadUnidad: Int
    let tiempoCoccionSeg: Int
}

func fetchProducts(companyId: String) async -> [String : ProductInfo] {
    guard let snap = try? await Firestore.firestore()
        .collection("empresas").document(companyId)
        .collection("productos").getDocuments()
    else { return [:]}
    
    return Dictionary (uniqueKeysWithValues: snap.documents.compactMap { doc -> (String, ProductInfo)? in
        let data = doc.data()
        guard let name  = data["nombre"] as? String,
              let price = data ["precio"] as? Double,
              let stock = data["stock"] as? Int,
              let capacidadUnidad = data["capacidadUnidad"] as? Int,
              let tiempoCoccionSeg = data["tiempoCoccionSeg"] as? Int
        else {return nil}
        
        return (doc.documentID, ProductInfo(name: name,
                                            price: price,
                                            stock: stock,
                                            capacidadUnidad: capacidadUnidad,
                                            tiempoCoccionSeg: tiempoCoccionSeg
                                           ))
    })
    
}


