import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  doc,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { Observable, combineLatest, map } from 'rxjs';

import { FIRESTORE } from '../../core/firebase.providers';
import { collectionData$ } from '../../core/firestore-rx';

export interface MesaLibre {
  id: string; // = número de mesa, como string (ver DATA_MODEL.md)
  numero: number;
}

export interface MesaVista {
  id: string;
  numero: number;
  estado: 'libre' | 'ocupada';
  clienteNombre?: string;
  abiertoEn?: Timestamp;
}

interface MesaDoc {
  numero: number;
  estado: 'libre' | 'ocupada';
  clienteId: string | null;
}

interface ClienteDoc {
  nombre: string;
  abiertoEn: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly firestore = inject(FIRESTORE);

  mesasLibres(): Observable<MesaLibre[]> {
    const ref = query(collection(this.firestore, 'mesas'), where('estado', '==', 'libre'), orderBy('numero'));
    return collectionData$<{ numero: number }>(ref);
  }

  /**
   * Todas las mesas, con el nombre del cliente y desde cuándo está abierta si
   * está ocupada — combina en el cliente los listeners de `mesas` y `clientes`
   * (ver CAM-02). Todavía no incluye el resumen de pedidos por mesa: depende
   * de CAM-03/CAM-04, que aún no existen.
   */
  mesasEnVivo(): Observable<MesaVista[]> {
    const mesas$ = collectionData$<MesaDoc>(query(collection(this.firestore, 'mesas'), orderBy('numero')));
    const clientes$ = collectionData$<ClienteDoc>(collection(this.firestore, 'clientes'));

    return combineLatest([mesas$, clientes$]).pipe(
      map(([mesas, clientes]) => {
        const clientePorId = new Map(clientes.map((c) => [c.id, c]));
        return mesas.map((mesa) => {
          const cliente = mesa.clienteId ? clientePorId.get(mesa.clienteId) : undefined;
          return {
            id: mesa.id,
            numero: mesa.numero,
            estado: mesa.estado,
            clienteNombre: cliente?.nombre,
            abiertoEn: cliente?.abiertoEn,
          };
        });
      }),
    );
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
