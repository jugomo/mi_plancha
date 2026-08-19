import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { Empresa } from '../../../core/empresa';
import { FIRESTORE } from '../../../core/firebase.providers';
import { collectionData$ } from '../../../core/firestore-rx';
import { NuevoAdministrador, UsuariosService } from '../../../core/usuarios.service';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private readonly firestore = inject(FIRESTORE);
  private readonly usuariosService = inject(UsuariosService);

  listar(): Observable<Empresa[]> {
    const ref = query(collection(this.firestore, 'empresas'), orderBy('nombre'));
    return collectionData$<Omit<Empresa, 'id'>>(ref);
  }

  async obtener(codigo: string): Promise<Empresa | undefined> {
    const snap = await getDoc(doc(this.firestore, 'empresas', codigo));
    return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Empresa, 'id'>) } : undefined;
  }

  private generarCodigo(): string {
    const letra = LETRAS[Math.floor(Math.random() * LETRAS.length)];
    const numero = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${letra}${numero}`;
  }

  /** Al azar + reintento contra un getDoc, en vez de un contador secuencial:
   *  a esta escala (26.000 códigos posibles) evita una condición de carrera
   *  entre dos altas de empresa simultáneas sin necesitar una transacción. */
  private async generarCodigoUnico(intentosMax = 10): Promise<string> {
    for (let i = 0; i < intentosMax; i++) {
      const candidato = this.generarCodigo();
      const snap = await getDoc(doc(this.firestore, 'empresas', candidato));
      if (!snap.exists()) return candidato;
    }
    throw new Error('no-se-pudo-generar-codigo-unico');
  }

  /**
   * Crea la empresa y su administrador dedicado en el mismo flujo. No es
   * atómico entre Auth y Firestore (mismo límite ya aceptado para
   * UsuariosService.crearEnEmpresa/crearAdministradorDeEmpresa, ver
   * core/firebase-secondary.ts) — si falla a mitad, queda una empresa sin
   * administrador, recuperable reintentando desde el CMS.
   */
  async crearConAdmin(nombreEmpresa: string, admin: NuevoAdministrador): Promise<string> {
    const codigo = await this.generarCodigoUnico();
    await setDoc(doc(this.firestore, 'empresas', codigo), {
      codigo,
      nombre: nombreEmpresa,
      activa: true,
      creadaEn: serverTimestamp(),
    });
    await this.usuariosService.crearAdministradorDeEmpresa(codigo, admin);
    return codigo;
  }

  actualizarActiva(codigo: string, activa: boolean): Promise<void> {
    return setDoc(doc(this.firestore, 'empresas', codigo), { activa }, { merge: true });
  }

  actualizarNombre(codigo: string, nombre: string): Promise<void> {
    return setDoc(doc(this.firestore, 'empresas', codigo), { nombre }, { merge: true });
  }
}
