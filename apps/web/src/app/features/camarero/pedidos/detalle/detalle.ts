import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Producto, ProductosService } from '../../../admin/productos/productos.service';
import { UMBRAL_STOCK_BAJO } from '../../../../core/alertas-stock.service';
import { Sesion } from '../../../../core/sesion';
import { Topbar } from '../../../../core/ui/topbar/topbar';
import {
  EstadoLinea,
  EstadoPedidoVista,
  LineaPedido,
  PedidoResumen,
  PedidosService,
  calcularEstadoPedidoVista,
  etiquetaEstadoPedidoVista,
} from '../../../../core/pedidos.service';

interface LineaVista extends LineaPedido {
  nombreProducto: string;
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
  private readonly productosService = inject(ProductosService);

  protected readonly pedidoId = inject(ActivatedRoute).snapshot.paramMap.get('pedidoId')!;

  protected readonly cargandoPedido = signal(true);
  protected pedido: PedidoResumen | undefined;
  protected readonly error = signal<string | null>(null);
  protected readonly confirmando = signal<string | null>(null); // id de línea con la confirmación en curso
  protected readonly accionError = signal<string | null>(null);

  private readonly lineas = toSignal(this.pedidosService.lineasDePedido(this.pedidoId), {
    initialValue: [] as LineaPedido[],
  });
  private readonly productos = toSignal(this.productosService.listar(), {
    initialValue: [] as Producto[],
  });
  // En vivo (no el `pedido` cargado una vez en el constructor) para poder distinguir
  // "esperando" de "cocinando" en cuanto un cocinero toma el pedido, sin recargar.
  private readonly pedidoEnVivo = toSignal(this.pedidosService.pedidoEnVivo(this.pedidoId), {
    initialValue: undefined as PedidoResumen | undefined,
  });

  protected readonly lineasVista = computed<LineaVista[]>(() => {
    const productoPorId = new Map(this.productos().map((i) => [i.id, i]));
    return this.lineas().map((linea) => {
      const producto = productoPorId.get(linea.productoId);
      return {
        ...linea,
        nombreProducto: producto?.nombre ?? linea.productoId,
        stockBajo: (producto?.stock ?? Infinity) <= UMBRAL_STOCK_BAJO,
      };
    });
  });

  protected readonly hayStockBajo = computed(() => this.lineasVista().some((l) => l.stockBajo));

  protected readonly estadoPedido = computed<EstadoPedidoVista>(() => {
    const cocineroId = this.pedidoEnVivo()?.cocineroId ?? this.pedido?.cocineroId ?? null;
    return calcularEstadoPedidoVista(
      cocineroId,
      this.lineas().map((l) => l.estado),
    );
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
    return {
      pendiente: 'Pendiente',
      en_plancha: 'En plancha',
      pendiente_entrega: 'Pendiente de entrega',
      listo: 'Entregado',
    }[estado];
  }

  etiquetaEstadoPedido(estado: EstadoPedidoVista): string {
    return etiquetaEstadoPedidoVista(estado);
  }

  /** CAM-07: confirmo que ya llevé el producto a la mesa — ahí es cuando pasa a "listo". */
  async confirmarEntrega(linea: LineaVista): Promise<void> {
    if (this.confirmando()) return;
    this.accionError.set(null);
    this.confirmando.set(linea.id);
    try {
      await this.pedidosService.confirmarEntrega(this.pedidoId, linea.id);
    } catch {
      this.accionError.set('No se pudo confirmar la entrega. Inténtalo de nuevo.');
    } finally {
      this.confirmando.set(null);
    }
  }
}
