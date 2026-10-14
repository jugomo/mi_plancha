package com.jugomo.miplancha.shared

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

// thresold to fire the low stock alert of a product
const val LOW_STOCK_THRESHOLD = 5

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
            doc.toProduct()?.let { doc.id to it }
        }.toMap()

    } catch (e: Exception) {
        return emptyMap()
    }
}

fun startListeningProducts(companyId: String) : Flow<Map<String, ProductInfo>> {
    return callbackFlow {
        val prodsRef = FirebaseFirestore.getInstance()
            .collection("empresas")
            .document(companyId)
            .collection("productos")

        val listenerProducts = prodsRef.addSnapshotListener { snapshot, error ->
            if(error != null) {
                close(error)
                return@addSnapshotListener
            }

            if(snapshot != null) {
                val productos : Map<String, ProductInfo> =
                    snapshot.documents.mapNotNull { doc ->
                        doc.toProduct()?.let { doc.id to it }
                    }.toMap()
                trySend(productos)
            }
        }

        awaitClose {
            listenerProducts.remove()
        }
    }
}

fun DocumentSnapshot.toProduct() : ProductInfo? {
    val name1 = getString("nombre")
    val price1 = getDouble("precio")
    val stock1 = getLong("stock")?.toInt()
    val capacity1 = getLong("capacidadUnidad")?.toInt()
    val cookTimeSecs1 = getLong("tiempoCoccionSeg")?.toInt()

    if(name1 == null || price1 == null || stock1 == null || capacity1 == null || cookTimeSecs1 == null) {
        return null
    } else {
        return ProductInfo(name1, price1, stock1,capacity1,cookTimeSecs1)
    }
}
