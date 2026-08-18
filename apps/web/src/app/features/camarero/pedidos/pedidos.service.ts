import { Injectable, inject } from '@angular/core';
import { Timestamp, collection, doc, getDoc, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { FIRESTORE } from '../../../core/firebase.providers';
import { collectionData$ } from '../../../core/firestore-rx';

export interface LineaNueva {
  ingredienteId: string;
  cantidad: number;
}

export interface ClienteContexto {
  id: string;
  mesaNumero: number;
  nombre: string;
}

export interface PedidoResumen {
  id: string;
  clienteId: string;
  mesaNumero: number;
  clienteNombre: string;
  creadoEn: Timestamp;
}

export type EstadoLinea = 'pendiente' | 'en_plancha' | 'listo';

export interface LineaPedido {
  id: string;
  ingredienteId: string;
  cantidad: number;
  estado: EstadoLinea;
}

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly firestore = inject(FIRESTORE);

  /**
   * Crea el pedido y todas sus líneas en un único batch. Todo el pedido entra
   * en el subgrupo 1 por ahora — la división real en tandas es una historia
   * P2 (ADM-03) todavía no construida, ver DOMAIN.md.
   */
  async crearPedido(cliente: ClienteContexto, camareroId: string, lineas: LineaNueva[]): Promise<string> {
    const batch = writeBatch(this.firestore);
    const pedidoRef = doc(collection(this.firestore, 'pedidos'));

    batch.set(pedidoRef, {
      clienteId: cliente.id,
      mesaNumero: cliente.mesaNumero,
      clienteNombre: cliente.nombre,
      camareroId,
      cocineroId: null,
      creadoEn: serverTimestamp(),
      subgrupoActual: 1,
      cuentaId: null,
    });

    for (const linea of lineas) {
      const lineaRef = doc(collection(this.firestore, 'pedidos', pedidoRef.id, 'lineas'));
      batch.set(lineaRef, {
        ingredienteId: linea.ingredienteId,
        cantidad: linea.cantidad,
        estado: 'pendiente',
        subgrupo: 1,
        colocadoEn: null,
        listoEn: null,
        usandoOverflow: false,
        // Denormalizado para las collection group queries del algoritmo de
        // sugerencia (ver DATA_MODEL.md / ALGORITHM.md).
        pedidoCreadoEn: serverTimestamp(),
        cocineroId: null,
        mesaNumero: cliente.mesaNumero,
      });
    }

    await batch.commit();
    return pedidoRef.id;
  }

  /** Pedidos de un cliente, en orden de creación — solo cabecera, sin líneas (CAM-04 las carga aparte). */
  pedidosDeCliente(clienteId: string): Observable<PedidoResumen[]> {
    const ref = query(collection(this.firestore, 'pedidos'), where('clienteId', '==', clienteId), orderBy('creadoEn'));
    return collectionData$<Omit<PedidoResumen, 'id'>>(ref);
  }

  async obtenerPedido(pedidoId: string): Promise<PedidoResumen | undefined> {
    const snap = await getDoc(doc(this.firestore, 'pedidos', pedidoId));
    return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<PedidoResumen, 'id'>) } : undefined;
  }

  /** Líneas de un pedido en tiempo real — el corazón de CAM-04. */
  lineasDePedido(pedidoId: string): Observable<LineaPedido[]> {
    return collectionData$<Omit<LineaPedido, 'id'>>(collection(this.firestore, 'pedidos', pedidoId, 'lineas'));
  }
}
