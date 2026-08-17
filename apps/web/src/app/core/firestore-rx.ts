// Pequeño puente Firestore -> RxJS, a mano en vez de @angular/fire (todavía sin
// soporte para Angular 22 — ver el README de apps/web). Se reutiliza en todos
// los servicios que necesiten listeners en tiempo real (DATA_MODEL.md).
import { DocumentReference, Query, onSnapshot } from 'firebase/firestore';
import { Observable } from 'rxjs';

export function collectionData$<T>(ref: Query): Observable<(T & { id: string })[]> {
  return new Observable((subscriber) => {
    return onSnapshot(
      ref,
      (snap) => subscriber.next(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))),
      (err) => subscriber.error(err),
    );
  });
}

export function docData$<T>(ref: DocumentReference): Observable<(T & { id: string }) | undefined> {
  return new Observable((subscriber) => {
    return onSnapshot(
      ref,
      (snap) => subscriber.next(snap.exists() ? { id: snap.id, ...(snap.data() as T) } : undefined),
      (err) => subscriber.error(err),
    );
  });
}
