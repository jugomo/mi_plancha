import { Injectable, inject } from '@angular/core';
import { Timestamp, collectionGroup, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Observable, combineLatest, map } from 'rxjs';

import {
  EntradaAlgoritmo,
  IngredienteAlgoritmo,
  PedidoAlgoritmo,
  SalidaAlgoritmo,
  calcularSugerencia,
} from '../../core/algoritmo-sugerencia';
import { FIRESTORE } from '../../core/firebase.providers';
import { docData$ } from '../../core/firestore-rx';
import { Ingrediente, IngredientesService } from '../admin/ingredientes/ingredientes.service';
import { PlanchaService } from './plancha.service';

interface LineaPendienteDoc {
  ingredienteId: string;
  cantidad: number;
  estado: string;
  subgrupo?: number;
  pedidoCreadoEn: Timestamp;
  mesaNumero: number;
}

export interface LineaPendienteConPedido extends LineaPendienteDoc {
  id: string;
  pedidoId: string;
}

@Injectable({ providedIn: 'root' })
export class SugerenciaService {
  private readonly firestore = inject(FIRESTORE);
  private readonly ingredientesService = inject(IngredientesService);
  private readonly planchaService = inject(PlanchaService);

  /**
   * Todas las líneas pendientes de cualquier pedido, con el id de su pedido
   * (derivado de la ruta del documento, no denormalizado). Es la cola de
   * candidatos del algoritmo — ver ALGORITHM.md y DATA_MODEL.md. El orderBy
   * es necesario para que la consulta encaje con el índice de collection
   * group ya existente (estado + pedidoCreadoEn) — ver PlanchaService.
   */
  lineasPendientes(): Observable<LineaPendienteConPedido[]> {
    return new Observable((subscriber) => {
      const ref = query(
        collectionGroup(this.firestore, 'lineas'),
        where('estado', '==', 'pendiente'),
        orderBy('pedidoCreadoEn'),
      );
      return onSnapshot(
        ref,
        (snap) => {
          subscriber.next(
            snap.docs.map((d) => ({
              id: d.id,
              pedidoId: d.ref.parent.parent!.id,
              ...(d.data() as LineaPendienteDoc),
            })),
          );
        },
        (err) => subscriber.error(err),
      );
    });
  }

  /** Mesa de origen de cada pedido — solo para mostrarlo en la sugerencia, no lo usa el algoritmo. */
  mesaPorPedido(lineas: LineaPendienteConPedido[]): Map<string, number> {
    const mapa = new Map<string, number>();
    for (const linea of lineas) mapa.set(linea.pedidoId, linea.mesaNumero);
    return mapa;
  }

  sugerencia(): Observable<SalidaAlgoritmo> {
    return combineLatest([
      this.lineasPendientes(),
      this.ingredientesService.listar(),
      this.planchaService.enPlancha(),
      this.planchaService.capacidadTotal(),
      docData$<{ tiempoMaximoEsperaMin: number }>(doc(this.firestore, 'config', 'antiInanicion')),
      docData$<{ porcentaje: number }>(doc(this.firestore, 'config', 'overflow')),
      docData$<{ overflowManualActivo: boolean }>(doc(this.firestore, 'plancha', 'estado')),
    ]).pipe(
      map(([lineasPendientes, ingredientes, enPlancha, capacidadTotal, antiInanicion, overflow, estadoPlancha]) => {
        const ingredientesMap: Record<string, IngredienteAlgoritmo> = {};
        for (const ing of ingredientes as Ingrediente[]) {
          ingredientesMap[ing.id] = { capacidadUnidad: ing.capacidadUnidad, tiempoCoccionSeg: ing.tiempoCoccionSeg };
        }

        const capacidadUsadaActual = enPlancha.reduce(
          (suma, l) => suma + (ingredientesMap[l.ingredienteId]?.capacidadUnidad ?? 0) * l.cantidad,
          0,
        );

        // Reconstruye los pedidos a partir de sus líneas pendientes — todo lo
        // que necesita el algoritmo ya viene denormalizado en cada línea
        // (pedidoCreadoEn), sin lecturas adicionales (ver DATA_MODEL.md).
        // subgrupoActual se asume 1 para todos: la división real en tandas es
        // ADM-03/CAM-03, todavía no construida (ver DOMAIN.md).
        const pedidosPorId = new Map<string, PedidoAlgoritmo>();
        for (const linea of lineasPendientes) {
          let pedido = pedidosPorId.get(linea.pedidoId);
          if (!pedido) {
            pedido = { id: linea.pedidoId, creadoEn: linea.pedidoCreadoEn.toMillis(), subgrupoActual: 1, lineas: [] };
            pedidosPorId.set(linea.pedidoId, pedido);
          }
          pedido.lineas.push({
            id: linea.id,
            ingrediente: linea.ingredienteId,
            cantidad: linea.cantidad,
            estado: linea.estado,
            subgrupo: linea.subgrupo ?? 1,
          });
        }

        const entrada: EntradaAlgoritmo = {
          ahora: Date.now(),
          planchaCapacidadTotal: capacidadTotal,
          overflowPorcentaje: overflow?.porcentaje ?? 0,
          overflowManualActivo: estadoPlancha?.overflowManualActivo ?? false,
          capacidadUsadaActual,
          tiempoMaximoEsperaMin: antiInanicion?.tiempoMaximoEsperaMin ?? Number.POSITIVE_INFINITY,
          division: { umbral: 0, tamanoSubgrupo: 0 },
          ingredientes: ingredientesMap,
          pedidos: [...pedidosPorId.values()],
        };

        return calcularSugerencia(entrada);
      }),
    );
  }
}
