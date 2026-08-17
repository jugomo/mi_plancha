import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfigService } from '../config/config.service';

interface ConfigPlancha {
  capacidadTotal: number;
}

@Component({
  selector: 'mp-admin-plancha',
  imports: [FormsModule],
  templateUrl: './plancha.html',
  styleUrl: './plancha.scss',
})
export class Plancha {
  private readonly config = inject(ConfigService);

  protected capacidadTotal = 100;

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.config
      .obtener<ConfigPlancha>('plancha')
      .then((datos) => {
        if (datos) this.capacidadTotal = datos.capacidadTotal;
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
      await this.config.guardar('plancha', { capacidadTotal: this.capacidadTotal });
      this.guardado.set(true);
    } catch {
      this.error.set('No se pudo guardar. Revisa el valor e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
