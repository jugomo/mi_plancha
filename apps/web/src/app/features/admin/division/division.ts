import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfigService } from '../config/config.service';

interface ConfigDivision {
  umbral: number;
  tamanoSubgrupo: number;
}

@Component({
  selector: 'mp-admin-division',
  imports: [FormsModule],
  templateUrl: './division.html',
  styleUrl: './division.scss',
})
export class Division {
  private readonly config = inject(ConfigService);

  protected umbral = 6;
  protected tamanoSubgrupo = 3;

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.config
      .obtener<ConfigDivision>('division')
      .then((datos) => {
        if (datos) {
          this.umbral = datos.umbral;
          this.tamanoSubgrupo = datos.tamanoSubgrupo;
        }
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
      await this.config.guardar('division', { umbral: this.umbral, tamanoSubgrupo: this.tamanoSubgrupo });
      this.guardado.set(true);
    } catch {
      this.error.set('No se pudo guardar. Revisa los valores e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
