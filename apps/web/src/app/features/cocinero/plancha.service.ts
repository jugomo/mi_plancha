import { Injectable, inject } from '@angular/core';
import { Timestamp, collectionGroup, doc, orderBy, query, where } from 'firebase/firestore';
import { Observable, map } from 'rxjs';

import { FIRESTORE } from '../../core/firebase.providers';
import { collectionData$, docData$ } from '../../core/firestore-rx';

export interface LineaEnPlancha {
  id: string;
  ingredienteId: string;
  cantidad: number;
  mesaNumero: number;
  colocadoEn: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class PlanchaService {
  private readonly firestore = inject(FIRESTORE);

  /**
   * Todas las líneas en cocción ahora mismo, de cualquier pedido, las más
   * antiguas primero. El `orderBy` no es solo cosmético: hace falta para que
   * la consulta encaje con el índice de collection group ya existente
   * (estado + pedidoCreadoEn, ver DATA_MODEL.md/ALGORITHM.md) — sin él,
   * Firestore pide un índice de un solo campo aparte para `estado` en
   * collection group.
   */
  enPlancha(): Observable<LineaEnPlancha[]> {
    const ref = query(
      collectionGroup(this.firestore, 'lineas'),
      where('estado', '==', 'en_plancha'),
      orderBy('pedidoCreadoEn'),
    );
    return collectionData$<Omit<LineaEnPlancha, 'id'>>(ref);
  }

  capacidadTotal(): Observable<number> {
    return docData$<{ capacidadTotal: number }>(doc(this.firestore, 'config', 'plancha')).pipe(
      map((datos) => datos?.capacidadTotal ?? 0),
    );
  }
}
