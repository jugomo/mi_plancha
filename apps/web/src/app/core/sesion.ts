import { Injectable, inject, signal } from '@angular/core';
import { Auth, User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Firestore, Unsubscribe, doc, onSnapshot } from 'firebase/firestore';

import { AUTH, FIRESTORE } from './firebase.providers';
import { emailSintetico } from './username-email';

export type Rol = 'camarero' | 'cocinero' | 'administrador' | 'superadmin';

export interface Usuario {
  uid: string;
  nombre: string;
  rol: Rol;
  empresaId: string | null; // código de empresa (ver core/empresa.ts); null solo para superadmin
}

/**
 * Sesión del usuario actual, combinando Firebase Auth con su documento
 * `usuarios/{uid}` (rol, empresaId, ver DATA_MODEL.md). Se escucha en tiempo
 * real: si un administrador/superadmin desactiva al usuario mientras tiene
 * sesión abierta, se cierra sola en cuanto llega el cambio (criterio de
 * aceptación de ADM-07). Además, si el usuario pertenece a una empresa
 * (todos menos superadmin), se escucha también `empresas/{empresaId}`: si el
 * superadmin desactiva la empresa, la sesión de todo su personal se cierra
 * igual — desactivar una empresa no debe limitarse a bloquear logins nuevos.
 *
 * `usuario()` vale `undefined` mientras se resuelve la sesión inicial,
 * `null` si no hay sesión válida (sin autenticar, autenticado pero sin
 * usuario activo, o con la empresa desactivada), o el `Usuario` una vez
 * cargado.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly auth = inject(AUTH);
  private readonly firestore = inject(FIRESTORE);

  readonly usuario = signal<Usuario | null | undefined>(undefined);

  private dejarDeEscucharUsuario: Unsubscribe | null = null;
  private dejarDeEscucharEmpresa: Unsubscribe | null = null;

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.alCambiarAuth(user));
  }

  private alCambiarAuth(user: User | null): void {
    this.dejarDeEscucharUsuario?.();
    this.dejarDeEscucharUsuario = null;
    this.dejarDeEscucharEmpresa?.();
    this.dejarDeEscucharEmpresa = null;

    if (!user) {
      this.usuario.set(null);
      return;
    }

    this.dejarDeEscucharUsuario = onSnapshot(doc(this.firestore, 'usuarios', user.uid), (snap) => {
      const datos = snap.data();
      if (!datos || datos['activo'] !== true) {
        this.cerrarPorSesionInvalida();
        return;
      }
      const empresaId = (datos['empresaId'] as string | null | undefined) ?? null;
      this.usuario.set({ uid: user.uid, nombre: datos['nombre'] ?? '', rol: datos['rol'], empresaId });
      this.escucharEmpresa(empresaId);
    });
  }

  private escucharEmpresa(empresaId: string | null): void {
    this.dejarDeEscucharEmpresa?.();
    this.dejarDeEscucharEmpresa = null;

    if (!empresaId) return; // superadmin no pertenece a ninguna empresa

    this.dejarDeEscucharEmpresa = onSnapshot(doc(this.firestore, 'empresas', empresaId), (snap) => {
      if (!snap.exists() || snap.data()['activa'] !== true) {
        this.cerrarPorSesionInvalida();
      }
    });
  }

  private cerrarPorSesionInvalida(): void {
    this.usuario.set(null);
    if (this.auth.currentUser) {
      void signOut(this.auth);
    }
  }

  async iniciarSesion(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
    // onAuthStateChanged recoge el cambio y carga usuarios/{uid}.
  }

  /** Login de camarero/cocinero: código de empresa + usuario, ver core/username-email.ts. */
  async iniciarSesionEmpresa(codigoEmpresa: string, username: string, password: string): Promise<void> {
    await this.iniciarSesion(emailSintetico(codigoEmpresa, username), password);
  }

  async cerrarSesion(): Promise<void> {
    await signOut(this.auth);
  }
}
