import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Observable } from 'rxjs';

import { FIRESTORE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';

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
  cocineroId: string | null;
  creadoEn: Timestamp;
  cuentaId: string | null;
}

// pendiente_entrega: el cocinero ya retiró el ingrediente de la plancha, pero
// todavía no ha confirmado que lo entregó físicamente en la mesa. "listo" pasa
// a significar "ya entregado", no solo "ya cocinado" — ver ARCHITECTURE.md
// (Máquina de estados de una línea de pedido).
export type EstadoLinea = 'pendiente' | 'en_plancha' | 'pendiente_entrega' | 'listo';

export interface LineaPedido {
  id: string;
  ingredienteId: string;
  cantidad: number;
  estado: EstadoLinea;
  colocadoEn: Timestamp | null;
  retiradoEn: Timestamp | null;
  listoEn: Timestamp | null;
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
        retiradoEn: null,
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

  /** Pedidos sin cocinero asignado todavía — la cola de COC-01. */
  pendientesSinAsignar(): Observable<PedidoResumen[]> {
    const ref = query(collection(this.firestore, 'pedidos'), where('cocineroId', '==', null), orderBy('creadoEn'));
    return collectionData$<Omit<PedidoResumen, 'id'>>(ref);
  }

  /** Pedidos que un cocinero concreto ha tomado (para volver a ellos tras navegar fuera). */
  misPedidos(cocineroId: string): Observable<PedidoResumen[]> {
    const ref = query(collection(this.firestore, 'pedidos'), where('cocineroId', '==', cocineroId), orderBy('creadoEn'));
    return collectionData$<Omit<PedidoResumen, 'id'>>(ref);
  }

  async obtenerPedido(pedidoId: string): Promise<PedidoResumen | undefined> {
    const snap = await getDoc(doc(this.firestore, 'pedidos', pedidoId));
    return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<PedidoResumen, 'id'>) } : undefined;
  }

  /** Cabecera de un pedido en tiempo real — para saber, sin recargar, en cuanto lo toma un cocinero (CAM-04). */
  pedidoEnVivo(pedidoId: string): Observable<PedidoResumen | undefined> {
    return docData$<Omit<PedidoResumen, 'id'>>(doc(this.firestore, 'pedidos', pedidoId));
  }

  /** Líneas de un pedido en tiempo real — el corazón de CAM-04 y del checklist de cocina. */
  lineasDePedido(pedidoId: string): Observable<LineaPedido[]> {
    return collectionData$<Omit<LineaPedido, 'id'>>(collection(this.firestore, 'pedidos', pedidoId, 'lineas'));
  }

  /**
   * Estado de todas las líneas de todos los pedidos, con el id de su pedido
   * (derivado de la ruta, igual que en SugerenciaService) — para saber, sin
   * un listener por pedido, cuáles están completos (ver Pendientes, COC-01).
   */
  estadoDeTodasLasLineas(): Observable<{ pedidoId: string; estado: EstadoLinea }[]> {
    return new Observable((subscriber) => {
      const ref = collectionGroup(this.firestore, 'lineas');
      return onSnapshot(
        ref,
        (snap) => {
          subscriber.next(
            snap.docs.map((d) => ({
              pedidoId: d.ref.parent.parent!.id,
              estado: (d.data()['estado'] as EstadoLinea) ?? 'pendiente',
            })),
          );
        },
        (err) => subscriber.error(err),
      );
    });
  }

  /** COC-03: exclusividad garantizada por la regla de seguridad, aquí solo damos un error legible si ya no está libre. */
  async tomarPedido(pedidoId: string, cocineroId: string): Promise<void> {
    await runTransaction(this.firestore, async (tx) => {
      const ref = doc(this.firestore, 'pedidos', pedidoId);
      const snap = await tx.get(ref);
      if (!snap.exists() || snap.data()['cocineroId'] !== null) {
        throw new Error('pedido-ya-tomado');
      }
      tx.update(ref, { cocineroId });
    });
  }

  /** COC-04: coloca el ingrediente en la plancha y descuenta stock a la vez. */
  async colocarEnPlancha(pedidoId: string, lineaId: string, ingredienteId: string, cantidad: number): Promise<void> {
    await runTransaction(this.firestore, async (tx) => {
      const ingredienteRef = doc(this.firestore, 'ingredientes', ingredienteId);
      const ingredienteSnap = await tx.get(ingredienteRef);
      const stockActual = (ingredienteSnap.data()?.['stock'] as number | undefined) ?? 0;
      if (stockActual < cantidad) {
        throw new Error('stock-insuficiente');
      }

      const lineaRef = doc(this.firestore, 'pedidos', pedidoId, 'lineas', lineaId);
      tx.update(lineaRef, { estado: 'en_plancha', colocadoEn: serverTimestamp() });
      tx.update(ingredienteRef, { stock: stockActual - cantidad });
    });
  }

  /** COC-06: el cocinero decide y confirma cuándo retira el ingrediente de la plancha — queda pendiente de entrega, no listo todavía. */
  async retirarDePlancha(pedidoId: string, lineaId: string): Promise<void> {
    const lineaRef = doc(this.firestore, 'pedidos', pedidoId, 'lineas', lineaId);
    await updateDoc(lineaRef, { estado: 'pendiente_entrega', retiradoEn: serverTimestamp() });
  }

  /** CAM-07: el camarero confirma que ya entregó el ingrediente en la mesa — aquí es cuando la línea pasa a "listo". */
  async confirmarEntrega(pedidoId: string, lineaId: string): Promise<void> {
    const lineaRef = doc(this.firestore, 'pedidos', pedidoId, 'lineas', lineaId);
    await updateDoc(lineaRef, { estado: 'listo', listoEn: serverTimestamp() });
  }

  /**
   * Borra un pedido ya facturado (cuentaId != null) para limpiar la lista de
   * completados del cocinero — la cuenta ya conserva todo lo necesario como
   * historial (ver DATA_MODEL.md). Las reglas de seguridad rechazan el borrado
   * si todavía no se generó la cuenta, así que esto es solo limpieza, no una
   * vía para perder datos operativos en curso.
   */
  async borrarPedidoCompletado(pedidoId: string): Promise<void> {
    const lineasSnap = await getDocs(collection(this.firestore, 'pedidos', pedidoId, 'lineas'));
    const batch = writeBatch(this.firestore);
    for (const lineaDoc of lineasSnap.docs) {
      batch.delete(lineaDoc.ref);
    }
    batch.delete(doc(this.firestore, 'pedidos', pedidoId));
    await batch.commit();
  }
}
