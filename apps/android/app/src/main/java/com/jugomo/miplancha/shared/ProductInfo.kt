package com.jugomo.miplancha.shared

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class ProductInfo (
    val name: String,
    val price: Double,
    val stock: Int,
    val capacity: Int,
    val cookTimeSecs: Int
)

suspend fun fetchProducts(companyId: String) : Map<String, ProductInfo> {
    val prodsRef = FirebaseFirestore.getInstance()
        .collection("empresas")
        .document(companyId)
        .collection("productos")

    try {
        val snapshot = prodsRef.get().await()

        return snapshot.documents.mapNotNull { doc ->
            val name = doc.getString("nombre") ?: return@mapNotNull null
            val price = doc.getDouble("precio") ?: return@mapNotNull null
            val stock = doc.getLong("stock")?.toInt() ?: return@mapNotNull null
            val capacity = doc.getLong("capacidadUnidad")?.toInt() ?: return@mapNotNull null
            val cookTimeSecs = doc.getLong("tiempoCoccionSeg")?.toInt() ?: return@mapNotNull null

            // generate the map pair k,v
            doc.id to ProductInfo(name, price, stock, capacity, cookTimeSecs)
        }.toMap()

    } catch (e: Exception) {
        return emptyMap()
    }
}