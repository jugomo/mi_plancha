import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { EstadoLinea, PedidoResumen, PedidosService } from '../../../core/pedidos.service';
import { Sesion } from '../../../core/sesion';
import { Topbar } from '../../../core/ui/topbar/topbar';

@Component({
  selector: 'mp-camarero-completados',
  imports: [RouterLink, Topbar],
  templateUrl: './completados.html',
  styleUrl: './completados.scss',
})
export class Completados {
  protected readonly sesion = inject(Sesion);
  private readonly pedidosService = inject(PedidosService);

  private readonly misPedidosTodos = toSignal(
    this.pedidosService.pedidosDeCamarero(this.sesion.usuario()?.uid ?? '__ninguno__'),
    { initialValue: [] as PedidoResumen[] },
  );
  private readonly estadoLineas = toSignal(this.pedidosService.estadoDeTodasLasLineas(), {
    initialValue: [] as { pedidoId: string; estado: EstadoLinea }[],
  });
  protected readonly borrando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  // Un pedido está completado, de cara al camarero, en cuanto todas sus
  // líneas llegan a "listo" (ya entregadas en mesa). Only the billed can be
  // deleted
  protected readonly pedidos = computed(() => {
    const porPedido = new Map<string, EstadoLinea[]>();
    for (const linea of this.estadoLineas()) {
      const lista = porPedido.get(linea.pedidoId) ?? [];
      lista.push(linea.estado);
      porPedido.set(linea.pedidoId, lista);
    }
    return this.misPedidosTodos().filter((p) => {
      const estados = porPedido.get(p.id) ?? [];
      return estados.length > 0 && estados.every((e) => e === 'listo');
    });
  });

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  async borrarPedido(pedido: PedidoResumen): Promise<void> {
    if (this.borrando()) return;

    if (
      !confirm(
        `¿Borrar el pedido de la mesa ${pedido.mesaNumero} · ` +
          `${pedido.clienteNombre}? Ya está facturado`,
      )
    ) {
      return;
    }

    this.error.set(null);
    this.borrando.set(pedido.id);

    try {
      await this.pedidosService.borrarPedidoCompletado(pedido.id);
    } catch {
      this.error.set('No se pudo borrar el pediod. Instenta de nuevo.');
    } finally {
      this.borrando.set(null);
    }
  }

  horaCreacion(pedido: PedidoResumen): string {
    return (
      pedido.creadoEn
        ?.toDate()
        .toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) ?? ''
    );
  }
}
