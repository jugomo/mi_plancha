import { Injectable, inject, signal } from '@angular/core';
import { Auth, User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Firestore, Unsubscribe, doc, onSnapshot } from 'firebase/firestore';

import { AUTH, FIRESTORE } from './firebase.providers';

export type Rol = 'camarero' | 'cocinero' | 'administrador';

export interface Usuario {
  uid: string;
  nombre: string;
  rol: Rol;
}

/**
 * Sesión del usuario actual, combinando Firebase Auth con su documento
 * `usuarios/{uid}` (rol, ver DATA_MODEL.md). Se escucha en tiempo real: si un
 * administrador desactiva al usuario mientras tiene sesión abierta, se cierra
 * sola en cuanto llega el cambio (criterio de aceptación de ADM-07).
 *
 * `usuario()` vale `undefined` mientras se resuelve la sesión inicial,
 * `null` si no hay sesión válida (sin autenticar, o autenticado pero sin
 * usuario activo), o el `Usuario` una vez cargado.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly auth = inject(AUTH);
  private readonly firestore = inject(FIRESTORE);

  readonly usuario = signal<Usuario | null | undefined>(undefined);

  private dejarDeEscucharUsuario: Unsubscribe | null = null;

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.alCambiarAuth(user));
  }

  private alCambiarAuth(user: User | null): void {
    this.dejarDeEscucharUsuario?.();
    this.dejarDeEscucharUsuario = null;

    if (!user) {
      this.usuario.set(null);
      return;
    }

    this.dejarDeEscucharUsuario = onSnapshot(doc(this.firestore, 'usuarios', user.uid), (snap) => {
      const datos = snap.data();
      if (!datos || datos['activo'] !== true) {
        this.usuario.set(null);
        if (this.auth.currentUser) {
          void signOut(this.auth);
        }
        return;
      }
      this.usuario.set({ uid: user.uid, nombre: datos['nombre'] ?? '', rol: datos['rol'] });
    });
  }

  async iniciarSesion(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
    // onAuthStateChanged recoge el cambio y carga usuarios/{uid}.
  }

  async cerrarSesion(): Promise<void> {
    await signOut(this.auth);
  }
}
