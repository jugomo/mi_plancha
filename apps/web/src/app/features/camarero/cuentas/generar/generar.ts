import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Sesion } from '../../../../core/sesion';
import { Topbar } from '../../../../core/ui/topbar/topbar';
import { ClientesService } from '../../clientes.service';
import { CuentasService, LineaCuenta } from '../cuentas.service';

interface PedidoAgrupado {
  pedidoId: string;
  lineas: LineaCuenta[];
  subtotal: number;
}

@Component({
  selector: 'mp-camarero-generar-cuenta',
  imports: [RouterLink, Topbar],
  templateUrl: './generar.html',
  styleUrl: './generar.scss',
})
export class Generar {
  protected readonly sesion = inject(Sesion);
  private readonly clientesService = inject(ClientesService);
  private readonly cuentasService = inject(CuentasService);
  private readonly router = inject(Router);

  protected readonly clienteId = inject(ActivatedRoute).snapshot.paramMap.get('clienteId')!;
  private mesaId = '';

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected clienteNombre = '';
  protected clienteMesaNumero = 0;

  protected pedidos: PedidoAgrupado[] = [];
  protected total = 0;
  private pedidoIds: string[] = [];

  protected readonly confirmando = signal(false);
  protected readonly cerrando = signal(false);

  constructor() {
    Promise.all([this.clientesService.obtenerCliente(this.clienteId), this.cuentasService.previsualizarCuenta(this.clienteId)])
      .then(([cliente, previa]) => {
        if (!cliente) {
          this.error.set('No se encontró el cliente — puede que ya se le haya generado la cuenta.');
          return;
        }
        this.clienteNombre = cliente.nombre;
        this.clienteMesaNumero = Number(cliente.mesaId);
        this.mesaId = cliente.mesaId;

        this.pedidoIds = previa.pedidoIds;
        this.total = previa.total;
        this.pedidos = this.agruparPorPedido(previa.lineas);
      })
      .catch(() => this.error.set('No se pudo cargar la cuenta.'))
      .finally(() => this.cargando.set(false));
  }

  private agruparPorPedido(lineas: LineaCuenta[]): PedidoAgrupado[] {
    const porPedido = new Map<string, LineaCuenta[]>();
    for (const linea of lineas) {
      const lista = porPedido.get(linea.pedidoId) ?? [];
      lista.push(linea);
      porPedido.set(linea.pedidoId, lista);
    }
    return this.pedidoIds
      .filter((id) => porPedido.has(id))
      .map((pedidoId) => {
        const lineasPedido = porPedido.get(pedidoId)!;
        return {
          pedidoId,
          lineas: lineasPedido,
          subtotal: lineasPedido.reduce((suma, l) => suma + l.subtotal, 0),
        };
      });
  }

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  async confirmar(): Promise<void> {
    const uid = this.sesion.usuario()?.uid;
    if (!uid || this.confirmando()) return;

    this.error.set(null);
    this.confirmando.set(true);
    try {
      await this.cuentasService.confirmarCuenta(
        { id: this.clienteId, mesaId: this.mesaId, nombre: this.clienteNombre },
        uid,
        { pedidoIds: this.pedidoIds, lineas: this.pedidos.flatMap((p) => p.lineas), total: this.total },
      );
      await this.router.navigateByUrl('/camarero');
    } catch {
      this.error.set('No se pudo generar la cuenta. Inténtalo de nuevo.');
      this.confirmando.set(false);
    }
  }

  /** Cliente que abrió mesa pero no llegó a pedir nada: no hay cuenta que generar, solo liberar la mesa. */
  async cerrarSinPedidos(): Promise<void> {
    if (this.cerrando()) return;

    this.error.set(null);
    this.cerrando.set(true);
    try {
      await this.cuentasService.cerrarMesaSinPedidos({ id: this.clienteId, mesaId: this.mesaId, nombre: this.clienteNombre });
      await this.router.navigateByUrl('/camarero');
    } catch {
      this.error.set('No se pudo cerrar la mesa. Inténtalo de nuevo.');
      this.cerrando.set(false);
    }
  }
}
