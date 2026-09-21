package com.jugomo.miplancha.waiter

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class TablesService {

    private val db = FirebaseFirestore.getInstance()
    private var companyId: String = ""
    var clientsCache: MutableMap<String, Cliente> = mutableMapOf()

    fun startListeningTables(companyId: String): Flow<List<Mesa>?> {
        this@TablesService.companyId = companyId

        return callbackFlow {
            val docRef = db.collection("empresas")
                .document(companyId)
                .collection("mesas")

            val listenerRegistration = docRef.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val mesas = snapshot.documents.map { it.toMesa() }
                    cleanCacheClient(mesas)
                    trySend(mesas)
                } else {
                    trySend(null)
                }
            }

            awaitClose {
                listenerRegistration.remove()
            }
        }
    }

    suspend fun getClient(clientId: String): Cliente? {
        val docRef = db.collection("empresas")
            .document(companyId)
            .collection("clientes")
            .document(clientId)

        val snapshot = docRef.get().await()
        return if (snapshot.exists()) snapshot.toCliente() else null

    }

    suspend fun cacheClient(table: Mesa) {
        val clientId = table.clienteId ?: return

        if(clientId !in clientsCache ){
            clientsCache[clientId] = getClient(clientId) ?: return
        }
    }

    fun cleanCacheClient(mesas: List<Mesa>) {
        clientsCache.keys.retainAll(mesas.mapNotNull { it.clienteId }.toSet())
    }
}
