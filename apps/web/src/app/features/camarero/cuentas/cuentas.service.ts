import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';

import { FIRESTORE } from '../../../core/firebase.providers';

export interface LineaCuenta {
  pedidoId: string;
  ingredienteNombre: string;
  cantidad: number;
  precioUnidad: number;
  subtotal: number;
}

export interface PreviaCuenta {
  pedidoIds: string[];
  lineas: LineaCuenta[];
  total: number;
}

export interface ClienteContexto {
  id: string;
  mesaId: string;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class CuentasService {
  private readonly firestore = inject(FIRESTORE);

  /**
   * Lectura puntual (no en tiempo real: es una foto para confirmar antes de
   * cerrar) de todos los pedidos del cliente, con snapshot de nombre y precio
   * de cada ingrediente en este momento — si el CMS cambia un precio después,
   * esta cuenta ya generada no se ve afectada (ver DATA_MODEL.md).
   */
  async previsualizarCuenta(clienteId: string): Promise<PreviaCuenta> {
    const pedidosSnap = await getDocs(query(collection(this.firestore, 'pedidos'), where('clienteId', '==', clienteId)));

    const lineasPorPedido: { pedidoId: string; ingredienteId: string; cantidad: number }[] = [];
    for (const pedidoDoc of pedidosSnap.docs) {
      const lineasSnap = await getDocs(collection(this.firestore, 'pedidos', pedidoDoc.id, 'lineas'));
      for (const lineaDoc of lineasSnap.docs) {
        const datos = lineaDoc.data() as { ingredienteId: string; cantidad: number };
        lineasPorPedido.push({ pedidoId: pedidoDoc.id, ingredienteId: datos.ingredienteId, cantidad: datos.cantidad });
      }
    }

    const ingredienteIds = [...new Set(lineasPorPedido.map((l) => l.ingredienteId))];
    const ingredientes = new Map<string, { nombre: string; precio: number }>();
    for (const id of ingredienteIds) {
      const snap = await getDoc(doc(this.firestore, 'ingredientes', id));
      if (snap.exists()) ingredientes.set(id, snap.data() as { nombre: string; precio: number });
    }

    let total = 0;
    const lineas: LineaCuenta[] = lineasPorPedido.map((l) => {
      const ingrediente = ingredientes.get(l.ingredienteId);
      const precioUnidad = ingrediente?.precio ?? 0;
      const subtotal = precioUnidad * l.cantidad;
      total += subtotal;
      return {
        pedidoId: l.pedidoId,
        ingredienteNombre: ingrediente?.nombre ?? l.ingredienteId,
        cantidad: l.cantidad,
        precioUnidad,
        subtotal,
      };
    });

    return { pedidoIds: pedidosSnap.docs.map((d) => d.id), lineas, total };
  }

  /** Transacción "Generar cuenta" de DATA_MODEL.md. */
  async confirmarCuenta(cliente: ClienteContexto, camareroId: string, previa: PreviaCuenta): Promise<string> {
    return runTransaction(this.firestore, async (tx) => {
      const clienteRef = doc(this.firestore, 'clientes', cliente.id);
      const clienteSnap = await tx.get(clienteRef);
      if (!clienteSnap.exists()) {
        throw new Error('cliente-ya-cerrado');
      }

      const cuentaRef = doc(collection(this.firestore, 'cuentas'));
      tx.set(cuentaRef, {
        mesaNumero: Number(cliente.mesaId),
        clienteNombre: cliente.nombre,
        camareroId,
        pedidoIds: previa.pedidoIds,
        lineas: previa.lineas,
        total: previa.total,
        generadaEn: serverTimestamp(),
      });

      for (const pedidoId of previa.pedidoIds) {
        tx.update(doc(this.firestore, 'pedidos', pedidoId), { cuentaId: cuentaRef.id });
      }

      tx.delete(clienteRef);
      tx.update(doc(this.firestore, 'mesas', cliente.mesaId), { estado: 'libre', clienteId: null });

      return cuentaRef.id;
    });
  }
}
