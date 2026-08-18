import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { PedidoResumen, PedidosService } from '../../../core/pedidos.service';
import { Sesion } from '../../../core/sesion';

@Component({
  selector: 'mp-cocinero-pendientes',
  imports: [RouterLink],
  templateUrl: './pendientes.html',
  styleUrl: './pendientes.scss',
})
export class Pendientes {
  private readonly sesion = inject(Sesion);
  private readonly pedidosService = inject(PedidosService);
  private readonly router = inject(Router);

  protected readonly pendientes = toSignal(this.pedidosService.pendientesSinAsignar(), {
    initialValue: [] as PedidoResumen[],
  });

  private readonly uid = computed(() => this.sesion.usuario()?.uid);

  protected readonly misPedidos = toSignal(
    this.pedidosService.misPedidos(this.sesion.usuario()?.uid ?? '__ninguno__'),
    { initialValue: [] as PedidoResumen[] },
  );

  protected readonly tomando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  esperandoDesde(pedido: PedidoResumen): string {
    const minutos = Math.max(0, Math.round((Date.now() - pedido.creadoEn.toMillis()) / 60000));
    if (minutos < 1) return 'hace un momento';
    return minutos === 1 ? 'hace 1 min' : `hace ${minutos} min`;
  }

  async tomar(pedido: PedidoResumen): Promise<void> {
    const uid = this.uid();
    if (!uid || this.tomando()) return;

    this.error.set(null);
    this.tomando.set(pedido.id);
    try {
      await this.pedidosService.tomarPedido(pedido.id, uid);
      await this.router.navigateByUrl(`/cocinero/pedidos/${pedido.id}`);
    } catch {
      this.error.set('Ese pedido ya lo ha tomado otro cocinero. Elige otro.');
      this.tomando.set(null);
    }
  }
}
