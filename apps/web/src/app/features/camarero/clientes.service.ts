import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDoc,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { Observable, combineLatest, map } from 'rxjs';

import { FIRESTORE } from '../../core/firebase.providers';
import { collectionData$ } from '../../core/firestore-rx';
import { Sesion } from '../../core/sesion';

export interface MesaLibre {
  id: string; // = número de mesa, como string (ver DATA_MODEL.md)
  numero: number;
}

export type EstadoPedidosMesa = 'sin_pedidos' | 'esperando' | 'en_plancha' | 'pendiente_entrega' | 'todo_listo';

export interface MesaVista {
  id: string;
  numero: number;
  estado: 'libre' | 'ocupada';
  clienteId?: string;
  clienteNombre?: string;
  abiertoEn?: Timestamp;
  estadoPedidos?: EstadoPedidosMesa;
}

export interface Cliente {
  id: string;
  mesaId: string;
  nombre: string;
  camareroId: string;
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

interface LineaConMesaYFecha {
  estado: string;
  mesaNumero: number;
  pedidoCreadoEn: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly firestore = inject(FIRESTORE);
  private readonly sesion = inject(Sesion);

  // Ver DATA_MODEL.md: mesas/clientes viven anidados bajo empresas/{empresaId}/...
  private empresaId(): string {
    const id = this.sesion.usuario()?.empresaId;
    if (!id) throw new Error('sin-empresa');
    return id;
  }

  private mesasRef() {
    return collection(this.firestore, 'empresas', this.empresaId(), 'mesas');
  }

  private clientesRef() {
    return collection(this.firestore, 'empresas', this.empresaId(), 'clientes');
  }

  mesasLibres(): Observable<MesaLibre[]> {
    const ref = query(this.mesasRef(), where('estado', '==', 'libre'), orderBy('numero'));
    return collectionData$<{ numero: number }>(ref);
  }

  /**
   * Todas las mesas, con el nombre del cliente, desde cuándo está abierta, y
   * en qué punto están sus pedidos (ver CAM-02): esperando / en plancha /
   * pendiente de entrega / todo listo — el mismo vocabulario de estado que ya
   * se ve línea a línea en el detalle de pedido (CAM-04), resumido aquí para
   * toda la sesión del cliente, para no tener que entrar a cada pedido para
   * saber si hay algo que ir a buscar a la plancha.
   *
   * Las líneas no llevan clienteId denormalizado (ver DATA_MODEL.md), así que
   * para no contar líneas de un cliente anterior que usó la misma mesa, solo
   * se cuentan las creadas desde que se abrió el cliente actual
   * (`pedidoCreadoEn >= cliente.abiertoEn`) — siempre es así, porque la mesa
   * no se puede reabrir para otro cliente hasta generar la cuenta del anterior.
   */
  mesasEnVivo(): Observable<MesaVista[]> {
    const mesas$ = collectionData$<MesaDoc>(query(this.mesasRef(), orderBy('numero')));
    const clientes$ = collectionData$<ClienteDoc>(this.clientesRef());
    const lineas$ = collectionData$<LineaConMesaYFecha>(
      query(collectionGroup(this.firestore, 'lineas'), where('empresaId', '==', this.empresaId())),
    );

    return combineLatest([mesas$, clientes$, lineas$]).pipe(
      map(([mesas, clientes, lineas]) => {
        const clientePorId = new Map(clientes.map((c) => [c.id, c]));
        return mesas.map((mesa) => {
          const cliente = mesa.clienteId ? clientePorId.get(mesa.clienteId) : undefined;
          return {
            id: mesa.id,
            numero: mesa.numero,
            estado: mesa.estado,
            clienteId: mesa.clienteId ?? undefined,
            clienteNombre: cliente?.nombre,
            abiertoEn: cliente?.abiertoEn,
            estadoPedidos: cliente ? this.calcularEstadoPedidos(mesa.numero, cliente, lineas) : undefined,
          };
        });
      }),
    );
  }

  private calcularEstadoPedidos(
    mesaNumero: number,
    cliente: ClienteDoc,
    lineas: LineaConMesaYFecha[],
  ): EstadoPedidosMesa {
    const abiertoEnMs = cliente.abiertoEn.toMillis();
    const lineasDeEstaSesion = lineas.filter(
      (l) => l.mesaNumero === mesaNumero && l.pedidoCreadoEn.toMillis() >= abiertoEnMs,
    );
    if (lineasDeEstaSesion.length === 0) return 'sin_pedidos';
    if (lineasDeEstaSesion.every((l) => l.estado === 'listo')) return 'todo_listo';
    // Orden de prioridad: lo más "accionable" primero — si hay algo ya
    // retirado de la plancha esperando que lo lleve a la mesa, eso manda
    // sobre que además haya otras líneas todavía en cocción.
    if (lineasDeEstaSesion.some((l) => l.estado === 'pendiente_entrega')) return 'pendiente_entrega';
    if (lineasDeEstaSesion.some((l) => l.estado === 'en_plancha')) return 'en_plancha';
    return 'esperando';
  }

  async obtenerCliente(id: string): Promise<Cliente | undefined> {
    const snap = await getDoc(doc(this.clientesRef(), id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Cliente, 'id'>) } : undefined;
  }

  /** Transacción "Abrir mesa" de DATA_MODEL.md: crea el cliente y ocupa la mesa a la vez. */
  async abrirMesa(mesaId: string, nombreCliente: string, camareroId: string): Promise<string> {
    return runTransaction(this.firestore, async (tx) => {
      const mesaRef = doc(this.mesasRef(), mesaId);
      const mesaSnap = await tx.get(mesaRef);
      if (!mesaSnap.exists() || mesaSnap.data()['estado'] !== 'libre') {
        throw new Error('mesa-no-libre');
      }

      const clienteRef = doc(this.clientesRef());
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
