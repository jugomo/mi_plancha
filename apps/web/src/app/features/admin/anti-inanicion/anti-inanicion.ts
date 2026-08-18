import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfigService } from '../config/config.service';

interface ConfigAntiInanicion {
  tiempoMaximoEsperaMin: number;
}

@Component({
  selector: 'mp-admin-anti-inanicion',
  imports: [FormsModule],
  templateUrl: './anti-inanicion.html',
  styleUrl: './anti-inanicion.scss',
})
export class AntiInanicion {
  private readonly config = inject(ConfigService);

  protected tiempoMaximoEsperaMin = 12;

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.config
      .obtener<ConfigAntiInanicion>('antiInanicion')
      .then((datos) => {
        if (datos) this.tiempoMaximoEsperaMin = datos.tiempoMaximoEsperaMin;
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
      await this.config.guardar('antiInanicion', { tiempoMaximoEsperaMin: this.tiempoMaximoEsperaMin });
      this.guardado.set(true);
    } catch {
      this.error.set('No se pudo guardar. Revisa el valor e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
