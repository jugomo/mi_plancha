import { Injectable, inject } from '@angular/core';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { authSecundaria } from './firebase-secondary';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { Rol } from './sesion';
import { emailSintetico } from './username-email';

export interface UsuarioFila {
  id: string; // uid
  nombre: string;
  email: string | null; // real para administrador/superadmin; sintético para camarero/cocinero
  username: string | null; // solo camarero/cocinero
  rol: Rol;
  empresaId: string | null; // null solo para superadmin
  activo: boolean;
}

/** Alta de camarero/cocinero — la hace un administrador (en su propia empresa) o el superadmin (en cualquiera). */
export interface NuevoUsuarioEmpresa {
  nombre: string;
  username: string;
  password: string;
  rol: 'camarero' | 'cocinero';
}

/** Alta del administrador único de una empresa — la hace solo EmpresasService.crearConAdmin(). */
export interface NuevoAdministrador {
  nombre: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly firestore = inject(FIRESTORE);

  /** Uso del administrador de una empresa: solo su propio personal. */
  listarPorEmpresa(empresaId: string): Observable<UsuarioFila[]> {
    const ref = query(collection(this.firestore, 'usuarios'), where('empresaId', '==', empresaId), orderBy('nombre'));
    return collectionData$<Omit<UsuarioFila, 'id'>>(ref);
  }

  /** Uso del superadmin: todos los usuarios de todas las empresas. */
  listarTodos(): Observable<UsuarioFila[]> {
    const ref = query(collection(this.firestore, 'usuarios'), orderBy('nombre'));
    return collectionData$<Omit<UsuarioFila, 'id'>>(ref);
  }

  /** Alta de camarero/cocinero — login por código de empresa + usuario (ver core/username-email.ts). */
  async crearEnEmpresa(empresaId: string, datos: NuevoUsuarioEmpresa): Promise<void> {
    const email = emailSintetico(empresaId, datos.username);
    await this.crearCuenta(empresaId, {
      nombre: datos.nombre,
      email,
      username: datos.username.trim().toLowerCase(),
      password: datos.password,
      rol: datos.rol,
    });
  }

  /** Alta del administrador de una empresa — login por email real, como superadmin. Solo desde EmpresasService. */
  async crearAdministradorDeEmpresa(empresaId: string, datos: NuevoAdministrador): Promise<void> {
    await this.crearCuenta(empresaId, {
      nombre: datos.nombre,
      email: datos.email,
      username: null,
      password: datos.password,
      rol: 'administrador',
    });
  }

  private async crearCuenta(
    empresaId: string,
    datos: { nombre: string; email: string; username: string | null; password: string; rol: Rol },
  ): Promise<void> {
    const auth = authSecundaria();
    const credencial = await createUserWithEmailAndPassword(auth, datos.email, datos.password);
    await signOut(auth); // no dejar la instancia secundaria con sesión abierta

    // Escrito con el Firestore de la app principal: la autoría es quien tiene
    // sesión ahí (administrador o superadmin), no el usuario recién creado.
    await setDoc(doc(this.firestore, 'usuarios', credencial.user.uid), {
      nombre: datos.nombre,
      email: datos.email,
      username: datos.username,
      rol: datos.rol,
      empresaId,
      activo: true,
      creadoEn: serverTimestamp(),
    });
  }

  actualizarRol(uid: string, rol: 'camarero' | 'cocinero'): Promise<void> {
    return setDoc(doc(this.firestore, 'usuarios', uid), { rol }, { merge: true });
  }

  actualizarActivo(uid: string, activo: boolean): Promise<void> {
    return setDoc(doc(this.firestore, 'usuarios', uid), { activo }, { merge: true });
  }

  /**
   * Borra solo el documento Firestore — la cuenta de Firebase Auth queda
   * huérfana (no hay Admin SDK en el cliente para borrarla; mismo límite ya
   * aceptado para las apps móviles huérfanas, ver PROGRESS.md).
   */
  eliminar(uid: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'usuarios', uid));
  }
}
