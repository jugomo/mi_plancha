// Requiere `Sesion`/`PedidosService`/`SugerenciaService` (Firestore real) o
// el Firebase Emulator Suite, todavía no configurado en este proyecto. El
// algoritmo en sí (calcularSugerencia) sí está cubierto de verdad — ver
// core/algoritmo-sugerencia.spec.ts.
import { describe, it } from 'vitest';

describe('Pendientes', () => {
  it.todo('cubrir con Firebase Emulator Suite (Firestore) — incluir la carrera al aceptar la sugerencia');
});
