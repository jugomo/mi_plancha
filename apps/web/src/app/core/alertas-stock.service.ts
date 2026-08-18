import { Injectable, inject } from '@angular/core';
import { collectionGroup } from 'firebase/firestore';
import { Observable, combineLatest, map } from 'rxjs';

import { Ingrediente, IngredientesService } from '../features/admin/ingredientes/ingredientes.service';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';

/** Umbral compartido de "stock bajo" (CAM-05) — mismo criterio visual que ya usaba el CMS de ingredientes. */
export const UMBRAL_STOCK_BAJO = 5;

interface LineaConMesa {
  ingredienteId: string;
  mesaNumero: number;
}

/**
 * Cruza ingredientes con stock bajo/agotado con las líneas de pedido que los
 * usan, para poder avisar en el tablero de mesas sin tener que escuchar cada
 * pedido de cada mesa por separado (una sola collection group query sobre
 * `lineas`, sin filtrar — a esta escala no hace falta más). La misma alerta
 * la verá también el cocinero cuando se construya COC-08 (P2).
 */
@Injectable({ providedIn: 'root' })
export class AlertasStockService {
  private readonly firestore = inject(FIRESTORE);
  private readonly ingredientesService = inject(IngredientesService);

  mesasConAlerta(): Observable<Set<number>> {
    const lineas$ = collectionData$<LineaConMesa>(collectionGroup(this.firestore, 'lineas'));

    return combineLatest([this.ingredientesService.listar(), lineas$]).pipe(
      map(([ingredientes, lineas]) => {
        const bajos = new Set(this.idsConStockBajo(ingredientes));
        const mesas = new Set<number>();
        for (const linea of lineas) {
          if (bajos.has(linea.ingredienteId)) mesas.add(linea.mesaNumero);
        }
        return mesas;
      }),
    );
  }

  private idsConStockBajo(ingredientes: Ingrediente[]): string[] {
    return ingredientes.filter((i) => i.stock <= UMBRAL_STOCK_BAJO).map((i) => i.id);
  }
}
