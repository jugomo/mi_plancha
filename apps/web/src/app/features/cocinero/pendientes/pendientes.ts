import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { ItemSugerencia, SalidaAlgoritmo } from '../../../core/algoritmo-sugerencia';
import {
  EstadoLinea,
  EstadoPedidoVista,
  PedidoResumen,
  PedidosService,
  calcularEstadoPedidoVista,
  etiquetaEstadoPedidoVista,
} from '../../../core/pedidos.service';
import { Sesion } from '../../../core/sesion';
import { Producto, ProductosService } from '../../admin/productos/productos.service';
import { LineaPendienteConPedido, SugerenciaService } from '../sugerencia.service';

interface ItemVista extends ItemSugerencia {
  nombreProducto: string;
  mesaNumero: number | undefined;
}

interface PedidoVista extends PedidoResumen {
  estadoVista: EstadoPedidoVista;
}

@Component({
  selector: 'mp-cocinero-pendientes',
  imports: [RouterLink],
  templateUrl: './pendientes.html',
  styleUrl: './pendientes.scss',
})
export class Pendientes {
  private readonly sesion = inject(Sesion);
  private readonly pedidosService = inject(PedidosService);
  private readonly sugerenciaService = inject(SugerenciaService);
  private readonly productosService = inject(ProductosService);
  private readonly router = inject(Router);

  protected readonly pendientes = toSignal(this.pedidosService.pendientesSinAsignar(), {
    initialValue: [] as PedidoResumen[],
  });

  private readonly uid = computed(() => this.sesion.usuario()?.uid);

  private readonly misPedidosTodos = toSignal(
    this.pedidosService.misPedidos(this.sesion.usuario()?.uid ?? '__ninguno__'),
    { initialValue: [] as PedidoResumen[] },
  );
  private readonly estadoLineas = toSignal(this.pedidosService.estadoDeTodasLasLineas(), {
    initialValue: [] as { pedidoId: string; estado: EstadoLinea }[],
  });

  private readonly estadosPorPedido = computed(() => {
    const porPedido = new Map<string, EstadoLinea[]>();
    for (const linea of this.estadoLineas()) {
      const lista = porPedido.get(linea.pedidoId) ?? [];
      lista.push(linea.estado);
      porPedido.set(linea.pedidoId, lista);
    }
    return porPedido;
  });

  private readonly completado = computed(() => {
    const completados = new Set<string>();
    for (const [pedidoId, estados] of this.estadosPorPedido()) {
      if (estados.length > 0 && estados.every((e) => e === 'listo')) completados.add(pedidoId);
    }
    return completados;
  });

  protected readonly misPedidosEnCurso = computed<PedidoVista[]>(() =>
    this.misPedidosTodos()
      .filter((p) => !this.completado().has(p.id))
      .map((p) => ({
        ...p,
        estadoVista: calcularEstadoPedidoVista(p.cocineroId, this.estadosPorPedido().get(p.id) ?? []),
      })),
  );

  private readonly sugerenciaBruta = toSignal(this.sugerenciaService.sugerencia(), {
    initialValue: { sugerencia: [], capacidadUsadaResultante: 0, alertas: [] } as SalidaAlgoritmo,
  });
  private readonly lineasPendientesTodas = toSignal(this.sugerenciaService.lineasPendientes(), {
    initialValue: [] as LineaPendienteConPedido[],
  });
  private readonly productos = toSignal(this.productosService.listar(), {
    initialValue: [] as Producto[],
  });

  protected readonly sugerenciaItems = computed<ItemVista[]>(() => {
    const productoPorId = new Map(this.productos().map((i) => [i.id, i]));
    const mesaPorPedido = this.sugerenciaService.mesaPorPedido(this.lineasPendientesTodas());
    return this.sugerenciaBruta().sugerencia.map((item) => ({
      ...item,
      nombreProducto: productoPorId.get(item.producto)?.nombre ?? item.producto,
      mesaNumero: mesaPorPedido.get(item.pedidoId),
    }));
  });

  protected readonly capacidadQueUsaria = computed(() =>
    this.sugerenciaItems().reduce(
      (suma, item) => suma + (this.productos().find((i) => i.id === item.producto)?.capacidadUnidad ?? 0) * item.cantidad,
      0,
    ),
  );

  // Hay líneas pendientes de verdad, pero el algoritmo no pudo sugerir
  // ninguna (ni siquiera vía alerta de forzado, ver calcularSugerencia) —
  // significa que no queda hueco libre en la plancha (ni con overflow), no
  // que no haya nada que cocinar. Sin esto, la sección de sugerencia
  // simplemente desaparecía sin explicar por qué.
  protected readonly planchaLlenaSinSugerir = computed(
    () =>
      this.lineasPendientesTodas().length > 0 &&
      this.sugerenciaItems().length === 0 &&
      this.alertasSugerencia().length === 0,
  );

  // COC-08: alerta legible con la mesa, no el id interno del pedido. Al ser
  // reactiva, deja de mostrarse sola en cuanto ese pedido consigue colocarse
  // (ya no aparece en `alertas`) — sin lógica extra para "ocultarla".
  protected readonly alertasSugerencia = computed(() => {
    const mesaPorPedido = this.sugerenciaService.mesaPorPedido(this.lineasPendientesTodas());
    return this.sugerenciaBruta().alertas.map((pedidoId) => {
      const mesa = mesaPorPedido.get(pedidoId);
      return mesa
        ? `⚠ El pedido de la mesa ${mesa} lleva demasiado esperando y no cabe en la plancha ni con capacidad extra.`
        : '⚠ Un pedido lleva demasiado esperando y no cabe en la plancha ni con capacidad extra.';
    });
  });

  protected readonly tomando = signal<string | null>(null);
  protected readonly aceptando = signal(false);
  protected readonly error = signal<string | null>(null);

  etiquetaEstado(estado: EstadoPedidoVista): string {
    return etiquetaEstadoPedidoVista(estado);
  }

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

  /**
   * Toma (si hace falta) y coloca en la plancha cada línea de la sugerencia.
   * Es orientativa: si algo cambió entre que se calculó y que se confirma
   * (otro cocinero se adelantó, el stock bajó), se salta esa línea en vez de
   * abortar el resto — ver criterio de aceptación de COC-02/03.
   */
  async aceptarSugerencia(): Promise<void> {
    const uid = this.uid();
    const items = this.sugerenciaItems();
    if (!uid || this.aceptando() || items.length === 0) return;

    this.error.set(null);
    this.aceptando.set(true);
    let fallos = 0;

    for (const item of items) {
      try {
        const pedido = await this.pedidosService.obtenerPedido(item.pedidoId);
        if (!pedido) continue;
        if (pedido.cocineroId === null) {
          await this.pedidosService.tomarPedido(item.pedidoId, uid);
        } else if (pedido.cocineroId !== uid) {
          fallos++;
          continue; // otro cocinero se adelantó a tomarlo
        }
        await this.pedidosService.colocarEnPlancha(item.pedidoId, item.lineaId, item.producto, item.cantidad);
      } catch {
        fallos++;
      }
    }

    if (fallos > 0) {
      this.error.set(`${fallos} de ${items.length} líneas ya no estaban disponibles (te adelantaron o cambió el stock).`);
    }
    this.aceptando.set(false);
  }
}
