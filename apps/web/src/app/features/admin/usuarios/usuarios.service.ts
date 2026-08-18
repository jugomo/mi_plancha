import { Injectable, inject } from '@angular/core';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { authSecundaria } from '../../../core/firebase-secondary';
import { FIRESTORE } from '../../../core/firebase.providers';
import { collectionData$ } from '../../../core/firestore-rx';
import { Rol } from '../../../core/sesion';

export interface UsuarioFila {
  id: string; // uid
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly firestore = inject(FIRESTORE);

  listar(): Observable<UsuarioFila[]> {
    const ref = query(collection(this.firestore, 'usuarios'), orderBy('nombre'));
    return collectionData$<Omit<UsuarioFila, 'id'>>(ref);
  }

  async crear(datos: NuevoUsuario): Promise<void> {
    const auth = authSecundaria();
    const credencial = await createUserWithEmailAndPassword(auth, datos.email, datos.password);
    await signOut(auth); // no dejar la instancia secundaria con sesión abierta

    // Escrito con el Firestore de la app principal: la autoría es el
    // administrador que tiene sesión ahí, no el usuario recién creado.
    await setDoc(doc(this.firestore, 'usuarios', credencial.user.uid), {
      nombre: datos.nombre,
      email: datos.email,
      rol: datos.rol,
      activo: true,
      creadoEn: serverTimestamp(),
    });
  }

  actualizarRol(uid: string, rol: Rol): Promise<void> {
    return setDoc(doc(this.firestore, 'usuarios', uid), { rol }, { merge: true });
  }

  actualizarActivo(uid: string, activo: boolean): Promise<void> {
    return setDoc(doc(this.firestore, 'usuarios', uid), { activo }, { merge: true });
  }
}
