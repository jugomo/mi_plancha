import { Injectable, inject } from '@angular/core';
import { collection, doc, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { FIRESTORE } from '../../core/firebase.providers';
import { collectionData$ } from '../../core/firestore-rx';

export interface MesaLibre {
  id: string; // = número de mesa, como string (ver DATA_MODEL.md)
  numero: number;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly firestore = inject(FIRESTORE);

  mesasLibres(): Observable<MesaLibre[]> {
    const ref = query(collection(this.firestore, 'mesas'), where('estado', '==', 'libre'), orderBy('numero'));
    return collectionData$<{ numero: number }>(ref);
  }

  /** Transacción "Abrir mesa" de DATA_MODEL.md: crea el cliente y ocupa la mesa a la vez. */
  async abrirMesa(mesaId: string, nombreCliente: string, camareroId: string): Promise<string> {
    return runTransaction(this.firestore, async (tx) => {
      const mesaRef = doc(this.firestore, 'mesas', mesaId);
      const mesaSnap = await tx.get(mesaRef);
      if (!mesaSnap.exists() || mesaSnap.data()['estado'] !== 'libre') {
        throw new Error('mesa-no-libre');
      }

      const clienteRef = doc(collection(this.firestore, 'clientes'));
      tx.set(clienteRef, {
        mesaId,
        nombre: nombreCliente,
        camareroId,
        abiertoEn: serverTimestamp(),
      });
      tx.update(mesaRef, { estado: 'ocupada', clienteId: clienteRef.id });

      return clienteRef.id;
    });
  }
}
