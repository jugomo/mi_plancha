import { Injectable, inject } from '@angular/core';
import { Timestamp, collectionGroup, doc, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Observable, map } from 'rxjs';

import { FIRESTORE } from '../../core/firebase.providers';
import { collectionData$, docData$ } from '../../core/firestore-rx';
import { Sesion } from '../../core/sesion';

export interface LineaEnPlancha {
  id: string;
  productoId: string;
  cantidad: number;
  mesaNumero: number;
  colocadoEn: Timestamp;
}

export interface EstadoPlancha {
  overflowManualActivo: boolean;
  activadoPor: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlanchaService {
  private readonly firestore = inject(FIRESTORE);
  private readonly sesion = inject(Sesion);

  private empresaId(): string {
    const id = this.sesion.usuario()?.empresaId;
    if (!id) throw new Error('sin-empresa');
    return id;
  }

  private empresaDoc(...pathSegments: string[]) {
    return doc(this.firestore, 'empresas', this.empresaId(), ...pathSegments);
  }

  /**
   * Todas las líneas en cocción ahora mismo, de esta empresa, las más
   * antiguas primero. El `orderBy` no es solo cosmético: hace falta para que
   * la consulta encaje con el índice de collection group ya existente
   * (empresaId + estado + pedidoCreadoEn, ver DATA_MODEL.md/ALGORITHM.md) —
   * sin él, Firestore pide un índice aparte.
   */
  enPlancha(): Observable<LineaEnPlancha[]> {
    const ref = query(
      collectionGroup(this.firestore, 'lineas'),
      where('empresaId', '==', this.empresaId()),
      where('estado', '==', 'en_plancha'),
      orderBy('pedidoCreadoEn'),
    );
    return collectionData$<Omit<LineaEnPlancha, 'id'>>(ref);
  }

  capacidadTotal(): Observable<number> {
    return docData$<{ capacidadTotal: number }>(this.empresaDoc('config', 'plancha')).pipe(
      map((datos) => datos?.capacidadTotal ?? 0),
    );
  }

  overflowPorcentaje(): Observable<number> {
    return docData$<{ porcentaje: number }>(this.empresaDoc('config', 'overflow')).pipe(
      map((datos) => datos?.porcentaje ?? 0),
    );
  }

  /** COC-07: cualquier cocinero puede activar/desactivar el overflow manual — es un ajuste de la plancha compartida, no personal. */
  estadoOverflow(): Observable<EstadoPlancha> {
    return docData$<EstadoPlancha>(this.empresaDoc('plancha', 'estado')).pipe(
      map((datos) => datos ?? { overflowManualActivo: false, activadoPor: null }),
    );
  }

  alternarOverflowManual(activo: boolean, cocineroId: string): Promise<void> {
    return setDoc(this.empresaDoc('plancha', 'estado'), {
      overflowManualActivo: activo,
      activadoPor: activo ? cocineroId : null,
      activadoEn: activo ? serverTimestamp() : null,
    });
  }
}
