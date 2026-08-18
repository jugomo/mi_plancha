import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Ingrediente, IngredientesService } from '../../admin/ingredientes/ingredientes.service';
import { LineaEnPlancha, PlanchaService } from '../plancha.service';

interface ItemEnPlancha {
  id: string;
  nombreIngrediente: string;
  cantidad: number;
  mesaNumero: number;
  capacidadUsada: number;
  restanteSeg: number;
}

interface TipoEnCapacidad {
  ingredienteId: string;
  nombre: string;
  capacidad: number;
}

@Component({
  selector: 'mp-cocinero-plancha',
  imports: [],
  templateUrl: './plancha.html',
  styleUrl: './plancha.scss',
})
export class Plancha {
  private readonly planchaService = inject(PlanchaService);
  private readonly ingredientesService = inject(IngredientesService);

  private readonly enPlancha = toSignal(this.planchaService.enPlancha(), { initialValue: [] as LineaEnPlancha[] });
  private readonly ingredientes = toSignal(this.ingredientesService.listar(), { initialValue: [] as Ingrediente[] });
  protected readonly capacidadTotal = toSignal(this.planchaService.capacidadTotal(), { initialValue: 0 });

  private readonly reloj = signal(Date.now());

  protected readonly items = computed<ItemEnPlancha[]>(() => {
    const ingredientePorId = new Map(this.ingredientes().map((i) => [i.id, i]));
    const ahora = this.reloj();
    return this.enPlancha().map((linea) => {
      const ingrediente = ingredientePorId.get(linea.ingredienteId);
      const finEstimado = linea.colocadoEn.toMillis() + (ingrediente?.tiempoCoccionSeg ?? 0) * 1000;
      return {
        id: linea.id,
        nombreIngrediente: ingrediente?.nombre ?? linea.ingredienteId,
        cantidad: linea.cantidad,
        mesaNumero: linea.mesaNumero,
        capacidadUsada: (ingrediente?.capacidadUnidad ?? 0) * linea.cantidad,
        restanteSeg: Math.max(0, Math.round((finEstimado - ahora) / 1000)),
      };
    });
  });

  protected readonly capacidadUsada = computed(() => this.items().reduce((suma, i) => suma + i.capacidadUsada, 0));

  protected readonly porTipo = computed<TipoEnCapacidad[]>(() => {
    const acumulado = new Map<string, TipoEnCapacidad>();
    for (const item of this.items()) {
      const actual = acumulado.get(item.nombreIngrediente);
      if (actual) {
        actual.capacidad += item.capacidadUsada;
      } else {
        acumulado.set(item.nombreIngrediente, {
          ingredienteId: item.id,
          nombre: item.nombreIngrediente,
          capacidad: item.capacidadUsada,
        });
      }
    }
    return [...acumulado.values()];
  });

  constructor() {
    const intervalo = setInterval(() => this.reloj.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  formatoRestante(segundos: number): string {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
  }

  porcentaje(capacidad: number): number {
    const total = this.capacidadTotal();
    return total > 0 ? Math.min(100, (capacidad / total) * 100) : 0;
  }
}
