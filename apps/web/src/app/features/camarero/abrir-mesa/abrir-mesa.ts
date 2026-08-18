import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { Sesion } from '../../../core/sesion';
import { Topbar } from '../../../core/ui/topbar/topbar';
import { ClientesService, MesaLibre } from '../clientes.service';

@Component({
  selector: 'mp-camarero-abrir-mesa',
  imports: [FormsModule, Topbar],
  templateUrl: './abrir-mesa.html',
  styleUrl: './abrir-mesa.scss',
})
export class AbrirMesa {
  protected readonly sesion = inject(Sesion);
  private readonly clientes = inject(ClientesService);

  protected readonly mesasLibres = toSignal(this.clientes.mesasLibres(), { initialValue: [] as MesaLibre[] });

  protected mesaId = '';
  protected nombre = '';

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly abierta = signal<{ mesa: string; nombre: string } | null>(null);

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  async abrir(): Promise<void> {
    const uid = this.sesion.usuario()?.uid;
    if (!uid || this.guardando() || !this.mesaId) return;

    this.error.set(null);
    this.guardando.set(true);
    const mesaAbierta = this.mesaId;
    const nombreAbierto = this.nombre.trim();
    try {
      await this.clientes.abrirMesa(mesaAbierta, nombreAbierto, uid);
      this.abierta.set({ mesa: mesaAbierta, nombre: nombreAbierto });
      this.mesaId = '';
      this.nombre = '';
    } catch {
      this.error.set('No se pudo abrir la mesa — puede que ya no esté libre. Inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
