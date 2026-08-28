//
//  ProductUtils.swift
//  MiPlancha
//
//  Created by julio on 28/08/2026.
//


import FirebaseFirestore


func fetchProductNames(companyId: String) async -> [String:String]  {
    guard let snapshot = try? await Firestore.firestore()
        .collection("empresas").document(companyId).collection("productos")
        .getDocuments()
    else {return [:]}
    
     return snapshot.documents.reduce(into: [:]) { dict, doc in
        if let nombre = doc.data()["nombre" ] as? String {
            dict[doc.documentID] = nombre
        }
    }
    
}
