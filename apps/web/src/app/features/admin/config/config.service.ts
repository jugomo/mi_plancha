import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { FIRESTORE } from '../../../core/firebase.providers';

/**
 * Acceso genérico a los documentos `config/*` (CMS) — capacidad de plancha,
 * división de pedidos, anti-inanición, overflow, mesas. Cada uno tiene su
 * propia validación de rango en firestore.rules; este servicio solo lee/escribe.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly firestore = inject(FIRESTORE);

  async obtener<T>(id: string): Promise<T | undefined> {
    const snap = await getDoc(doc(this.firestore, 'config', id));
    return snap.exists() ? (snap.data() as T) : undefined;
  }

  guardar(id: string, datos: Record<string, unknown>): Promise<void> {
    return setDoc(doc(this.firestore, 'config', id), datos);
  }
}
