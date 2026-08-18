import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfigService } from '../config/config.service';

interface ConfigOverflow {
  porcentaje: number;
}

@Component({
  selector: 'mp-admin-overflow',
  imports: [FormsModule],
  templateUrl: './overflow.html',
  styleUrl: './overflow.scss',
})
export class Overflow {
  private readonly config = inject(ConfigService);

  protected porcentaje = 10;

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.config
      .obtener<ConfigOverflow>('overflow')
      .then((datos) => {
        if (datos) this.porcentaje = datos.porcentaje;
      })
      .catch(() => this.error.set('No se pudo cargar la configuración.'))
      .finally(() => this.cargando.set(false));
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.error.set(null);
    this.guardado.set(false);
    this.guardando.set(true);
    try {
      await this.config.guardar('overflow', { porcentaje: this.porcentaje });
      this.guardado.set(true);
    } catch {
      this.error.set('No se pudo guardar. Revisa el valor e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
