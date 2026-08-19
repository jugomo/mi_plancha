import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Producto, ProductosService } from '../../admin/productos/productos.service';
import { LineaPedido, PedidoResumen, PedidosService } from '../../../core/pedidos.service';
import { Sesion } from '../../../core/sesion';
import { Topbar } from '../../../core/ui/topbar/topbar';

interface LineaVista extends LineaPedido {
  nombreProducto: string;
  tiempoCoccionSeg: number;
  restanteSeg: number | null; // null si no está en plancha
}

@Component({
  selector: 'mp-cocinero-pedido',
  imports: [RouterLink, Topbar],
  templateUrl: './pedido.html',
  styleUrl: './pedido.scss',
})
export class Pedido {
  protected readonly sesion = inject(Sesion);
  private readonly pedidosService = inject(PedidosService);
  private readonly productosService = inject(ProductosService);

  protected readonly pedidoId = inject(ActivatedRoute).snapshot.paramMap.get('pedidoId')!;

  protected readonly cargandoPedido = signal(true);
  protected pedido: PedidoResumen | undefined;
  protected readonly error = signal<string | null>(null);
  protected readonly ocupada = signal<string | null>(null); // id de línea con una acción en curso

  private readonly lineas = toSignal(this.pedidosService.lineasDePedido(this.pedidoId), {
    initialValue: [] as LineaPedido[],
  });
  private readonly productos = toSignal(this.productosService.listar(), {
    initialValue: [] as Producto[],
  });

  // Reloj que se actualiza cada segundo, solo para recalcular las cuentas
  // atrás en pantalla — no dispara ninguna lectura de red.
  private readonly reloj = signal(Date.now());

  protected readonly lineasVista = computed<LineaVista[]>(() => {
    const productoPorId = new Map(this.productos().map((i) => [i.id, i]));
    const ahora = this.reloj();
    return this.lineas().map((linea) => {
      const producto = productoPorId.get(linea.productoId);
      let restanteSeg: number | null = null;
      if (linea.estado === 'en_plancha' && linea.colocadoEn && producto) {
        const finEstimado = linea.colocadoEn.toMillis() + producto.tiempoCoccionSeg * 1000;
        restanteSeg = Math.max(0, Math.round((finEstimado - ahora) / 1000));
      }
      return {
        ...linea,
        nombreProducto: producto?.nombre ?? linea.productoId,
        tiempoCoccionSeg: producto?.tiempoCoccionSeg ?? 0,
        restanteSeg,
      };
    });
  });

  constructor() {
    const intervalo = setInterval(() => this.reloj.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));

    this.pedidosService
      .obtenerPedido(this.pedidoId)
      .then((pedido) => {
        if (!pedido) {
          this.error.set('No se encontró el pedido.');
          return;
        }
        if (pedido.cocineroId !== this.sesion.usuario()?.uid) {
          this.error.set('Este pedido no está asignado a ti.');
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

  formatoRestante(segundos: number): string {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
  }

  async ponerEnPlancha(linea: LineaVista): Promise<void> {
    if (this.ocupada()) return;
    this.error.set(null);
    this.ocupada.set(linea.id);
    try {
      await this.pedidosService.colocarEnPlancha(this.pedidoId, linea.id, linea.productoId, linea.cantidad);
    } catch {
      this.error.set(`No hay stock suficiente de ${linea.nombreProducto} ahora mismo.`);
    } finally {
      this.ocupada.set(null);
    }
  }

  async retirarDePlancha(linea: LineaVista): Promise<void> {
    if (this.ocupada()) return;
    this.error.set(null);
    this.ocupada.set(linea.id);
    try {
      await this.pedidosService.retirarDePlancha(this.pedidoId, linea.id);
    } catch {
      this.error.set('No se pudo retirar de la plancha. Inténtalo de nuevo.');
    } finally {
      this.ocupada.set(null);
    }
  }
}
