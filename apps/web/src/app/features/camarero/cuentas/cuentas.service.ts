import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';

import { FIRESTORE } from '../../../core/firebase.providers';
import { Sesion } from '../../../core/sesion';

export interface LineaCuenta {
  pedidoId: string;
  productoNombre: string;
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
  private readonly sesion = inject(Sesion);

  private empresaId(): string {
    const id = this.sesion.usuario()?.empresaId;
    if (!id) throw new Error('sin-empresa');
    return id;
  }

  private empresaRef() {
    return doc(this.firestore, 'empresas', this.empresaId());
  }

  private coleccion(nombre: string) {
    return collection(this.empresaRef(), nombre);
  }

  /**
   * Lectura puntual (no en tiempo real: es una foto para confirmar antes de
   * cerrar) de todos los pedidos del cliente, con snapshot de nombre y precio
   * de cada producto en este momento — si el CMS cambia un precio después,
   * esta cuenta ya generada no se ve afectada (ver DATA_MODEL.md).
   */
  async previsualizarCuenta(clienteId: string): Promise<PreviaCuenta> {
    const pedidosSnap = await getDocs(query(this.coleccion('pedidos'), where('clienteId', '==', clienteId)));

    const lineasPorPedido: { pedidoId: string; productoId: string; cantidad: number }[] = [];
    for (const pedidoDoc of pedidosSnap.docs) {
      const lineasSnap = await getDocs(collection(pedidoDoc.ref, 'lineas'));
      for (const lineaDoc of lineasSnap.docs) {
        const datos = lineaDoc.data() as { productoId: string; cantidad: number };
        lineasPorPedido.push({ pedidoId: pedidoDoc.id, productoId: datos.productoId, cantidad: datos.cantidad });
      }
    }

    const productoIds = [...new Set(lineasPorPedido.map((l) => l.productoId))];
    const productos = new Map<string, { nombre: string; precio: number }>();
    for (const id of productoIds) {
      const snap = await getDoc(doc(this.coleccion('productos'), id));
      if (snap.exists()) productos.set(id, snap.data() as { nombre: string; precio: number });
    }

    let total = 0;
    const lineas: LineaCuenta[] = lineasPorPedido.map((l) => {
      const producto = productos.get(l.productoId);
      const precioUnidad = producto?.precio ?? 0;
      const subtotal = precioUnidad * l.cantidad;
      total += subtotal;
      return {
        pedidoId: l.pedidoId,
        productoNombre: producto?.nombre ?? l.productoId,
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
      const clienteRef = doc(this.coleccion('clientes'), cliente.id);
      const clienteSnap = await tx.get(clienteRef);
      if (!clienteSnap.exists()) {
        throw new Error('cliente-ya-cerrado');
      }

      const cuentaRef = doc(this.coleccion('cuentas'));
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
        tx.update(doc(this.coleccion('pedidos'), pedidoId), { cuentaId: cuentaRef.id });
      }

      tx.delete(clienteRef);
      tx.update(doc(this.coleccion('mesas'), cliente.mesaId), { estado: 'libre', clienteId: null });

      return cuentaRef.id;
    });
  }

  /**
   * Cierra la mesa de un cliente que nunca llegó a pedir nada — no tiene
   * sentido generar una cuenta (nada que listar, nada que sumar), así que
   * esto libera la mesa directamente sin crear un documento en `cuentas/`.
   * Mismo criterio de "Generar cuenta" para el resto: borra el cliente y
   * libera la mesa en la misma transacción.
   */
  async cerrarMesaSinPedidos(cliente: ClienteContexto): Promise<void> {
    await runTransaction(this.firestore, async (tx) => {
      const clienteRef = doc(this.coleccion('clientes'), cliente.id);
      const clienteSnap = await tx.get(clienteRef);
      if (!clienteSnap.exists()) {
        throw new Error('cliente-ya-cerrado');
      }
      tx.delete(clienteRef);
      tx.update(doc(this.coleccion('mesas'), cliente.mesaId), { estado: 'libre', clienteId: null });
    });
  }
}
