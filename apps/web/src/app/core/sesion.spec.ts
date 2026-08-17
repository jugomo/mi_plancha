// `Sesion` llama a `onAuthStateChanged`/`onSnapshot` del SDK real de Firebase
// desde su constructor, que no aceptan un `AUTH`/`FIRESTORE` de mentira (fallan
// al acceder a estructura interna de la instancia real). Probarlo de verdad
// requiere el Firebase Emulator Suite, que todavía no está configurado en este
// proyecto — ver PROGRESS.md. Se deja constancia aquí en vez de fingir una
// prueba unitaria que no prueba nada real.
import { describe, it } from 'vitest';

describe('Sesion', () => {
  it.todo('cubrir con Firebase Emulator Suite (Auth + Firestore)');
});
