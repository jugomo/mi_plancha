import { Injectable, inject } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, getDoc, orderBy, query, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { FIRESTORE } from '../../../core/firebase.providers';
import { collectionData$ } from '../../../core/firestore-rx';

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

  listar(): Observable<Producto[]> {
    const ref = query(collection(this.firestore, 'productos'), orderBy('nombre'));
    return collectionData$<ProductoEntrada>(ref);
  }

  async obtener(id: string): Promise<Producto | undefined> {
    const snap = await getDoc(doc(this.firestore, 'productos', id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as ProductoEntrada) } : undefined;
  }

  crear(datos: ProductoEntrada): Promise<unknown> {
    return addDoc(collection(this.firestore, 'productos'), datos);
  }

  actualizar(id: string, datos: ProductoEntrada): Promise<void> {
    return setDoc(doc(this.firestore, 'productos', id), datos);
  }

  eliminar(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'productos', id));
  }
}
