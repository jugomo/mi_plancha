import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AlertasStockService } from '../../../core/alertas-stock.service';
import { Sesion } from '../../../core/sesion';
import { Topbar } from '../../../core/ui/topbar/topbar';
import { ClientesService, MesaVista } from '../clientes.service';

@Component({
  selector: 'mp-camarero-mesas',
  imports: [RouterLink, Topbar],
  templateUrl: './mesas.html',
  styleUrl: './mesas.scss',
})
export class Mesas {
  protected readonly sesion = inject(Sesion);
  private readonly clientes = inject(ClientesService);
  private readonly alertasStock = inject(AlertasStockService);

  protected readonly mesas = toSignal(this.clientes.mesasEnVivo(), { initialValue: [] as MesaVista[] });
  protected readonly mesasConAlerta = toSignal(this.alertasStock.mesasConAlerta(), { initialValue: new Set<number>() });

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  // Se recalcula solo cuando llega un cambio en tiempo real (mesas/clientes),
  // no hay un reloj que lo refresque cada minuto por su cuenta — suficiente
  // para el MVP, ver USER_STORIES.md (CAM-02).
  tiempoAbierta(mesa: MesaVista): string {
    if (!mesa.abiertoEn) return '';
    const minutos = Math.max(0, Math.round((Date.now() - mesa.abiertoEn.toMillis()) / 60000));
    if (minutos < 1) return 'hace un momento';
    return minutos === 1 ? 'hace 1 min' : `hace ${minutos} min`;
  }

  etiquetaEstadoPedidos(mesa: MesaVista): string {
    switch (mesa.estadoPedidos) {
      case 'todo_listo':
        return '✓ Todo listo';
      case 'esperando':
        return '⏳ Esperando';
      default:
        return '';
    }
  }
}
