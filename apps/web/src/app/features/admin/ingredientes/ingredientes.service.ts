import { Injectable, inject } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, getDoc, orderBy, query, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { FIRESTORE } from '../../../core/firebase.providers';
import { collectionData$ } from '../../../core/firestore-rx';

export interface Ingrediente {
  id: string;
  nombre: string;
  capacidadUnidad: number;
  tiempoCoccionSeg: number;
  stock: number;
  precio: number;
}

export type IngredienteEntrada = Omit<Ingrediente, 'id'>;

@Injectable({ providedIn: 'root' })
export class IngredientesService {
  private readonly firestore = inject(FIRESTORE);

  listar(): Observable<Ingrediente[]> {
    const ref = query(collection(this.firestore, 'ingredientes'), orderBy('nombre'));
    return collectionData$<IngredienteEntrada>(ref);
  }

  async obtener(id: string): Promise<Ingrediente | undefined> {
    const snap = await getDoc(doc(this.firestore, 'ingredientes', id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as IngredienteEntrada) } : undefined;
  }

  crear(datos: IngredienteEntrada): Promise<unknown> {
    return addDoc(collection(this.firestore, 'ingredientes'), datos);
  }

  actualizar(id: string, datos: IngredienteEntrada): Promise<void> {
    return setDoc(doc(this.firestore, 'ingredientes', id), datos);
  }

  eliminar(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'ingredientes', id));
  }
}
