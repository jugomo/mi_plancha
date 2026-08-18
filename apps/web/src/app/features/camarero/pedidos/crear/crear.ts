import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Ingrediente, IngredientesService } from '../../../admin/ingredientes/ingredientes.service';
import { Sesion } from '../../../../core/sesion';
import { Topbar } from '../../../../core/ui/topbar/topbar';
import { ClientesService } from '../../clientes.service';
import { PedidosService } from '../../../../core/pedidos.service';

@Component({
  selector: 'mp-camarero-pedido-crear',
  imports: [RouterLink, Topbar],
  templateUrl: './crear.html',
  styleUrl: './crear.scss',
})
export class Crear {
  protected readonly sesion = inject(Sesion);
  private readonly ingredientesService = inject(IngredientesService);
  private readonly clientesService = inject(ClientesService);
  private readonly pedidosService = inject(PedidosService);
  private readonly router = inject(Router);

  private readonly clienteId = inject(ActivatedRoute).snapshot.paramMap.get('clienteId')!;

  protected readonly ingredientes = toSignal(this.ingredientesService.listar(), {
    initialValue: [] as Ingrediente[],
  });
  protected readonly cantidades = signal<Record<string, number>>({});

  protected readonly cargandoCliente = signal(true);
  protected clienteNombre = '';
  protected clienteMesaNumero = 0;

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly totalSeleccionado = computed(() =>
    Object.values(this.cantidades()).reduce((total, cantidad) => total + cantidad, 0),
  );

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

  cantidad(id: string): number {
    return this.cantidades()[id] ?? 0;
  }

  incrementar(ingrediente: Ingrediente): void {
    const actual = this.cantidad(ingrediente.id);
    if (actual >= ingrediente.stock) return; // nunca por encima del stock (CAM-03)
    this.cantidades.update((mapa) => ({ ...mapa, [ingrediente.id]: actual + 1 }));
  }

  decrementar(id: string): void {
    const actual = this.cantidad(id);
    if (actual <= 0) return;
    this.cantidades.update((mapa) => ({ ...mapa, [id]: actual - 1 }));
  }

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  async confirmar(): Promise<void> {
    const uid = this.sesion.usuario()?.uid;
    if (!uid || this.guardando() || this.totalSeleccionado() === 0) return;

    const lineas = Object.entries(this.cantidades())
      .filter(([, cantidad]) => cantidad > 0)
      .map(([ingredienteId, cantidad]) => ({ ingredienteId, cantidad }));

    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.pedidosService.crearPedido(
        { id: this.clienteId, mesaNumero: this.clienteMesaNumero, nombre: this.clienteNombre },
        uid,
        lineas,
      );
      await this.router.navigateByUrl('/camarero');
    } catch {
      this.error.set('No se pudo crear el pedido. Puede que el stock haya cambiado — revisa las cantidades.');
      this.guardando.set(false);
    }
  }
}
