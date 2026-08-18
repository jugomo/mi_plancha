import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Sesion } from '../../../../core/sesion';
import { Topbar } from '../../../../core/ui/topbar/topbar';
import { ClientesService } from '../../clientes.service';
import { PedidoResumen, PedidosService } from '../pedidos.service';

@Component({
  selector: 'mp-camarero-cliente-pedidos',
  imports: [RouterLink, Topbar],
  templateUrl: './cliente.html',
  styleUrl: './cliente.scss',
})
export class ClientePedidos {
  protected readonly sesion = inject(Sesion);
  private readonly clientesService = inject(ClientesService);
  private readonly pedidosService = inject(PedidosService);

  protected readonly clienteId = inject(ActivatedRoute).snapshot.paramMap.get('clienteId')!;

  protected readonly cargandoCliente = signal(true);
  protected clienteNombre = '';
  protected clienteMesaNumero = 0;
  protected readonly error = signal<string | null>(null);

  protected readonly pedidos = toSignal(this.pedidosService.pedidosDeCliente(this.clienteId), {
    initialValue: [] as PedidoResumen[],
  });

  constructor() {
    this.clientesService
      .obtenerCliente(this.clienteId)
      .then((cliente) => {
        if (!cliente) {
          this.error.set('No se encontró el cliente — puede que ya se le haya generado la cuenta.');
          return;
        }
        this.clienteNombre = cliente.nombre;
        this.clienteMesaNumero = Number(cliente.mesaId);
      })
      .catch(() => this.error.set('No se pudo cargar el cliente.'))
      .finally(() => this.cargandoCliente.set(false));
  }

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  horaCreacion(pedido: PedidoResumen): string {
    return pedido.creadoEn?.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) ?? '';
  }
}
