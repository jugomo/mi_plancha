import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Empresa } from '../../../../core/empresa';
import { EmpresasService } from '../empresas.service';

@Component({
  selector: 'mp-empresas-lista',
  imports: [RouterLink],
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class Lista {
  private readonly servicio = inject(EmpresasService);

  protected readonly empresas = toSignal(this.servicio.listar(), { initialValue: [] as Empresa[] });
  protected readonly ocupada = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async alternarActiva(empresa: Empresa): Promise<void> {
    this.error.set(null);
    this.ocupada.set(empresa.id);
    try {
      await this.servicio.actualizarActiva(empresa.id, !empresa.activa);
    } catch {
      this.error.set('No se pudo actualizar. Inténtalo de nuevo.');
    } finally {
      this.ocupada.set(null);
    }
  }
}
