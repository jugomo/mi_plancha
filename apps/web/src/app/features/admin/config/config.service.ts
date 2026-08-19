import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { FIRESTORE } from '../../../core/firebase.providers';
import { Sesion } from '../../../core/sesion';

/**
 * Acceso genérico a los documentos `empresas/{empresaId}/config/*` (CMS) —
 * capacidad de plancha, división de pedidos, anti-inanición, overflow, mesas.
 * Cada uno tiene su propia validación de rango en firestore.rules; este
 * servicio solo lee/escribe, siempre dentro de la empresa del usuario actual.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly firestore = inject(FIRESTORE);
  private readonly sesion = inject(Sesion);

  private empresaId(): string {
    const id = this.sesion.usuario()?.empresaId;
    if (!id) throw new Error('sin-empresa');
    return id;
  }

  async obtener<T>(id: string): Promise<T | undefined> {
    const snap = await getDoc(doc(this.firestore, 'empresas', this.empresaId(), 'config', id));
    return snap.exists() ? (snap.data() as T) : undefined;
  }

  guardar(id: string, datos: Record<string, unknown>): Promise<void> {
    return setDoc(doc(this.firestore, 'empresas', this.empresaId(), 'config', id), datos);
  }
}
