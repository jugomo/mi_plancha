import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { EstadoLinea, PedidoResumen, PedidosService } from '../../../core/pedidos.service';
import { Sesion } from '../../../core/sesion';

@Component({
  selector: 'mp-cocinero-completados',
  imports: [RouterLink],
  templateUrl: './completados.html',
  styleUrl: './completados.scss',
})
export class Completados {
  private readonly sesion = inject(Sesion);
  private readonly pedidosService = inject(PedidosService);

  private readonly misPedidosTodos = toSignal(
    this.pedidosService.misPedidos(this.sesion.usuario()?.uid ?? '__ninguno__'),
    { initialValue: [] as PedidoResumen[] },
  );
  private readonly estadoLineas = toSignal(this.pedidosService.estadoDeTodasLasLineas(), {
    initialValue: [] as { pedidoId: string; estado: EstadoLinea }[],
  });

  private readonly completado = computed(() => {
    const porPedido = new Map<string, EstadoLinea[]>();
    for (const linea of this.estadoLineas()) {
      const lista = porPedido.get(linea.pedidoId) ?? [];
      lista.push(linea.estado);
      porPedido.set(linea.pedidoId, lista);
    }
    const completados = new Set<string>();
    for (const [pedidoId, estados] of porPedido) {
      if (estados.length > 0 && estados.every((e) => e === 'listo')) completados.add(pedidoId);
    }
    return completados;
  });

  protected readonly pedidos = computed(() => this.misPedidosTodos().filter((p) => this.completado().has(p.id)));

  protected readonly borrando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async borrarPedido(pedido: PedidoResumen): Promise<void> {
    if (this.borrando()) return;
    if (!confirm(`¿Borrar el pedido de la mesa ${pedido.mesaNumero} · ${pedido.clienteNombre}? Ya está facturado.`)) {
      return;
    }
    this.error.set(null);
    this.borrando.set(pedido.id);
    try {
      await this.pedidosService.borrarPedidoCompletado(pedido.id);
    } catch {
      this.error.set('No se pudo borrar el pedido. Inténtalo de nuevo.');
    } finally {
      this.borrando.set(null);
    }
  }
}
