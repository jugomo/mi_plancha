import { Injectable, inject } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, getDoc, orderBy, query, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { FIRESTORE } from '../../../core/firebase.providers';
import { collectionData$ } from '../../../core/firestore-rx';
import { Sesion } from '../../../core/sesion';

export interface Producto {
  id: string;
  nombre: string;
  capacidadUnidad: number;
  tiempoCoccionSeg: number;
  stock: number;
  precio: number;
}

export type ProductoEntrada = Omit<Producto, 'id'>;

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly firestore = inject(FIRESTORE);
  private readonly sesion = inject(Sesion);

  // Todas las colecciones operativas viven anidadas bajo empresas/{empresaId}/... —
  // ver DATA_MODEL.md. Cada método resuelve la empresa del usuario actual
  // internamente en vez de recibirla por parámetro, para no arriesgar una fuga
  // entre empresas por un argumento mal pasado en algún punto de llamada.
  private empresaId(): string {
    const id = this.sesion.usuario()?.empresaId;
    if (!id) throw new Error('sin-empresa');
    return id;
  }

  private coleccion() {
    return collection(this.firestore, 'empresas', this.empresaId(), 'productos');
  }

  listar(): Observable<Producto[]> {
    const ref = query(this.coleccion(), orderBy('nombre'));
    return collectionData$<ProductoEntrada>(ref);
  }

  async obtener(id: string): Promise<Producto | undefined> {
    const snap = await getDoc(doc(this.coleccion(), id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as ProductoEntrada) } : undefined;
  }

  crear(datos: ProductoEntrada): Promise<unknown> {
    return addDoc(this.coleccion(), datos);
  }

  actualizar(id: string, datos: ProductoEntrada): Promise<void> {
    return setDoc(doc(this.coleccion(), id), datos);
  }

  eliminar(id: string): Promise<void> {
    return deleteDoc(doc(this.coleccion(), id));
  }
}
