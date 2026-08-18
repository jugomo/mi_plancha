import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { UMBRAL_STOCK_BAJO } from '../../../../core/alertas-stock.service';
import { Ingrediente, IngredientesService } from '../ingredientes.service';

@Component({
  selector: 'mp-ingredientes-lista',
  imports: [CommonModule, RouterLink],
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class Lista {
  private readonly servicio = inject(IngredientesService);

  protected readonly umbralStockBajo = UMBRAL_STOCK_BAJO;
  protected readonly ingredientes = toSignal(this.servicio.listar(), { initialValue: [] as Ingrediente[] });
  protected readonly borrando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async eliminar(ingrediente: Ingrediente): Promise<void> {
    if (!confirm(`¿Eliminar "${ingrediente.nombre}"?`)) return;
    this.error.set(null);
    this.borrando.set(ingrediente.id);
    try {
      await this.servicio.eliminar(ingrediente.id);
    } catch {
      this.error.set('No se pudo eliminar. Inténtalo de nuevo.');
    } finally {
      this.borrando.set(null);
    }
  }
}
