import { Injectable, inject } from '@angular/core';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { FIRESTORE } from '../../../core/firebase.providers';

export interface LineaNueva {
  ingredienteId: string;
  cantidad: number;
}

export interface ClienteContexto {
  id: string;
  mesaNumero: number;
  nombre: string;
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
}
