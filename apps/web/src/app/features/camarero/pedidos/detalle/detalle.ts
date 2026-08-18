import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Ingrediente, IngredientesService } from '../../../admin/ingredientes/ingredientes.service';
import { UMBRAL_STOCK_BAJO } from '../../../../core/alertas-stock.service';
import { Sesion } from '../../../../core/sesion';
import { Topbar } from '../../../../core/ui/topbar/topbar';
import { EstadoLinea, LineaPedido, PedidoResumen, PedidosService } from '../../../../core/pedidos.service';

interface LineaVista extends LineaPedido {
  nombreIngrediente: string;
  stockBajo: boolean;
}

@Component({
  selector: 'mp-camarero-pedido-detalle',
  imports: [RouterLink, Topbar],
  templateUrl: './detalle.html',
  styleUrl: './detalle.scss',
})
export class Detalle {
  protected readonly sesion = inject(Sesion);
  private readonly pedidosService = inject(PedidosService);
  private readonly ingredientesService = inject(IngredientesService);

  protected readonly pedidoId = inject(ActivatedRoute).snapshot.paramMap.get('pedidoId')!;

  protected readonly cargandoPedido = signal(true);
  protected pedido: PedidoResumen | undefined;
  protected readonly error = signal<string | null>(null);

  private readonly lineas = toSignal(this.pedidosService.lineasDePedido(this.pedidoId), {
    initialValue: [] as LineaPedido[],
  });
  private readonly ingredientes = toSignal(this.ingredientesService.listar(), {
    initialValue: [] as Ingrediente[],
  });

  protected readonly lineasVista = computed<LineaVista[]>(() => {
    const ingredientePorId = new Map(this.ingredientes().map((i) => [i.id, i]));
    return this.lineas().map((linea) => {
      const ingrediente = ingredientePorId.get(linea.ingredienteId);
      return {
        ...linea,
        nombreIngrediente: ingrediente?.nombre ?? linea.ingredienteId,
        stockBajo: (ingrediente?.stock ?? Infinity) <= UMBRAL_STOCK_BAJO,
      };
    });
  });

  protected readonly hayStockBajo = computed(() => this.lineasVista().some((l) => l.stockBajo));

  protected readonly estadoPedido = computed<EstadoLinea>(() => {
    const lineas = this.lineas();
    if (lineas.length > 0 && lineas.every((l) => l.estado === 'listo')) return 'listo';
    if (lineas.some((l) => l.estado === 'en_plancha' || l.estado === 'listo')) return 'en_plancha';
    return 'pendiente';
  });

  constructor() {
    this.pedidosService
      .obtenerPedido(this.pedidoId)
      .then((pedido) => {
        if (!pedido) {
          this.error.set('No se encontró el pedido.');
          return;
        }
        this.pedido = pedido;
      })
      .catch(() => this.error.set('No se pudo cargar el pedido.'))
      .finally(() => this.cargandoPedido.set(false));
  }

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  etiquetaEstado(estado: EstadoLinea): string {
    return { pendiente: 'Pendiente', en_plancha: 'En plancha', listo: 'Listo' }[estado];
  }
}
