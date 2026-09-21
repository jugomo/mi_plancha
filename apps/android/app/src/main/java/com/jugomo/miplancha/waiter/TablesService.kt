package com.jugomo.miplancha.waiter

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class TablesService {

    private val db = FirebaseFirestore.getInstance()

    fun startListeningTables(companyId: String): Flow<List<Mesa>?> = callbackFlow {
        val docRef = db.collection("empresas")
            .document(companyId)
            .collection("mesas")

        val listenerRegistration = docRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }

            if (snapshot != null) {
                trySend(snapshot.documents.map { it.toMesa() })
            } else {
                trySend(null)
            }
        }

        awaitClose {
            listenerRegistration.remove()
        }
    }

    fun startListeningClient(companyId: String, clientId: String): Flow<List<Cliente>?> = callbackFlow {
        val docRef = db.collection("empresas")
            .document(companyId)
            .collection("clientes")

        val listenerRegistration = docRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }

            if (snapshot != null) {
                trySend(snapshot.documents.map { it.toCliente() })
            } else {
                trySend(null)
            }
        }

        awaitClose {
            listenerRegistration.remove()
        }
    }
}
