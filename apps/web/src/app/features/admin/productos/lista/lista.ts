import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { UMBRAL_STOCK_BAJO } from '../../../../core/alertas-stock.service';
import { Producto, ProductosService } from '../productos.service';

@Component({
  selector: 'mp-productos-lista',
  imports: [CommonModule, RouterLink],
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class Lista {
  private readonly servicio = inject(ProductosService);

  protected readonly umbralStockBajo = UMBRAL_STOCK_BAJO;
  protected readonly productos = toSignal(this.servicio.listar(), { initialValue: [] as Producto[] });
  protected readonly borrando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async eliminar(producto: Producto): Promise<void> {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    this.error.set(null);
    this.borrando.set(producto.id);
    try {
      await this.servicio.eliminar(producto.id);
    } catch {
      this.error.set('No se pudo eliminar. Inténtalo de nuevo.');
    } finally {
      this.borrando.set(null);
    }
  }
}
