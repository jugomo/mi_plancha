import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';

import { FIRESTORE } from '../../../core/firebase.providers';
import { ConfigService } from '../config/config.service';

interface ConfigMesas {
  numeroDeMesas: number;
}

@Component({
  selector: 'mp-admin-mesas',
  imports: [FormsModule],
  templateUrl: './mesas.html',
  styleUrl: './mesas.scss',
})
export class Mesas {
  private readonly firestore = inject(FIRESTORE);
  private readonly config = inject(ConfigService);

  protected numeroDeMesas = 12;

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.config
      .obtener<ConfigMesas>('mesas')
      .then((datos) => {
        if (datos) this.numeroDeMesas = datos.numeroDeMesas;
      })
      .catch(() => this.error.set('No se pudo cargar la configuración.'))
      .finally(() => this.cargando.set(false));
  }

  // No hay backend que mantenga config/mesas.numeroDeMesas y los documentos
  // mesas/{numero} sincronizados (ver DATA_MODEL.md) — lo hace esta pantalla,
  // en un único batch atómico. El máximo actual se calcula a partir de los
  // documentos reales, no del valor guardado en config, para ser resistente
  // a que ambos se hayan desincronizado alguna vez.
  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.error.set(null);
    this.guardado.set(false);
    this.guardando.set(true);

    try {
      const actuales = await getDocs(collection(this.firestore, 'mesas'));
      const maximoActual = actuales.docs.reduce((max, d) => Math.max(max, Number(d.id)), 0);
      const nuevo = this.numeroDeMesas;

      const batch = writeBatch(this.firestore);

      if (nuevo > maximoActual) {
        for (let n = maximoActual + 1; n <= nuevo; n++) {
          batch.set(doc(this.firestore, 'mesas', String(n)), { numero: n, estado: 'libre', clienteId: null });
        }
      } else if (nuevo < maximoActual) {
        const aBorrar = actuales.docs.filter((d) => Number(d.id) > nuevo);
        const ocupada = aBorrar.find((d) => d.data()['estado'] === 'ocupada');
        if (ocupada) {
          this.error.set(`No se puede reducir a ${nuevo}: la mesa ${ocupada.id} está ocupada ahora mismo.`);
          return;
        }
        for (const d of aBorrar) batch.delete(d.ref);
      }

      batch.set(doc(this.firestore, 'config', 'mesas'), { numeroDeMesas: nuevo });
      await batch.commit();
      this.guardado.set(true);
    } catch {
      this.error.set('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
