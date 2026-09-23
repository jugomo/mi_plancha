package com.jugomo.miplancha.waiter

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import androidx.compose.runtime.mutableStateMapOf
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue

class TablesService {

    private val db = FirebaseFirestore.getInstance()
    private var companyId: String = ""
    var clientsCache = mutableStateMapOf<String, Client>()
    var tableOrderInfo = mutableStateMapOf<Int, TableOrderSummary>()
    var tablesAllDelivered = mutableStateMapOf<Int, Timestamp>()

    fun startListeningTables(companyId: String): Flow<List<Table>?> {
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
                    val mesas = snapshot.documents.map { it.toTable() }
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

    fun startListeningOrdersByTable(companyId: String): Flow<Map<Int, List<LineStatus>>?> {
        return callbackFlow {
            val docRef = db.collectionGroup("lineas")
                .whereEqualTo("empresaId", companyId)
                .whereNotEqualTo("estado", "listo")

            val listenerRegistration = docRef.addSnapshotListener { snapshot, error ->
                if(error != null) {
                    close(error)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val porMesa: Map<Int, List<LineStatus>> =
                        snapshot.documents
                            .mapNotNull { doc ->
                                val mesa = doc.getLong("mesaNumero")?.toInt() ?:
                                return@mapNotNull null
                                val estado = doc.getString("estado") ?:
                                return@mapNotNull null
                                mesa to LineStatus.valueOf(estado.uppercase())
                            }
                            .groupBy({ it.first }, { it.second })

                    val previas = tableOrderInfo.keys.toSet()

                    porMesa.forEach { (numeroMesa, estados) ->
                        val peor = worstStatus(estados) ?: return@forEach
                        tableOrderInfo[numeroMesa] = TableOrderSummary(
                            worstStatus = peor,
                            lastUpdate = Timestamp.now(),
                            displayLabel = null
                        )
                    }

                    val yaEntregadas = previas - porMesa.keys
                    yaEntregadas.forEach { numeroMesa ->
                        tablesAllDelivered[numeroMesa] = Timestamp.now()
                        tableOrderInfo.remove(numeroMesa)
                    }

                    trySend(porMesa)
                } else {
                    trySend(null)
                }
            }

            awaitClose { listenerRegistration.remove() }
        }
    }

    suspend fun openTable(table: Table, waiterId: String, clientName: String) {
        val tableRef = db.collection("empresas")
            .document(companyId)
            .collection("mesas")
            .document(table.id)
        val clientRef = db.collection("empresas")
            .document(companyId)
            .collection("clientes")
            .document()

        val docRef = db.runTransaction { trn ->
            val tableSnp = trn.get(tableRef)
            if(tableSnp.exists() && tableSnp.data!!["estado"] == "libre") {
                trn.set(
                    clientRef,
                    mapOf(
                        "mesaId" to table.id,
                        "nombre" to clientName,
                        "camareroId" to waiterId,
                        "abiertoEn" to FieldValue.serverTimestamp()
                    )
                )
                trn.update(
                    tableRef,
                    mapOf(
                        "estado" to "ocupada",
                        "clienteId" to clientRef.id
                    )
                )
            } else {
                throw MesaOcupadaError(msg = "no se pudo abrir la mesa")
            }
        }.await()
    }

    suspend fun backfillDeliveredIfNeeded(tableNumber: Int, clientSatAt: Timestamp?) {
        val snap = db.collectionGroup("lineas")
            .whereEqualTo("empresaId", companyId)
            .whereEqualTo("mesaNumero", tableNumber)
            .whereEqualTo("estado", "listo")
            .get()
            .await()

        val dates = snap.documents.mapNotNull { doc ->
            val createdAt = doc.getTimestamp("pedidoCreadoEn") ?: return@mapNotNull null
            if (clientSatAt != null  && createdAt < clientSatAt) return@mapNotNull null
            doc.getTimestamp("colocadoEn" ) ?: createdAt
        }

        val last = dates.maxOrNull() ?: return

        if(tableOrderInfo[tableNumber] == null) {
            tablesAllDelivered[tableNumber] = last
        }
    }

    fun orderSummary(
        table: Table,
        tableOrderInfo : Map<Int, TableOrderSummary>,
        tablesAllDelivered: Map<Int, Timestamp>,
        clientSatAt: Timestamp?
    ) : TableOrderSummary?{
        tableOrderInfo[table.numero]?.let { return it }

        tablesAllDelivered[table.numero]?.let {
            return TableOrderSummary(
                worstStatus = LineStatus.LISTO,
                lastUpdate = it,
                displayLabel = null
            )
        }

        if(clientSatAt != null) {
            return TableOrderSummary(
                worstStatus = LineStatus.PENDIENTE,
                lastUpdate = clientSatAt,
                displayLabel = "Esperando camarero"
            )
        }

        return null
    }


    suspend fun getClient(clientId: String): Client? {
        val docRef = db.collection("empresas")
            .document(companyId)
            .collection("clientes")
            .document(clientId)

        val snapshot = docRef.get().await()
        return if (snapshot.exists()) snapshot.toClient() else null

    }

    suspend fun cacheClient(table: Table) {
        val clientId = table.clienteId ?: return

        if(clientId !in clientsCache ){
            clientsCache[clientId] = getClient(clientId) ?: return
        }
    }

    fun cleanCacheClient(tables: List<Table>) {
        clientsCache.keys.retainAll(tables.mapNotNull { it.clienteId }.toSet())
    }
}

class MesaOcupadaError(msg: String) : Exception(msg) {
}