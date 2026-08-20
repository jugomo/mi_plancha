// Helpers de conexión para demo.mjs.
//
// A diferencia de firebase/seed.js (Admin SDK, que se salta las Security
// Rules por completo — ver ARCHITECTURE.md), este script usa el mismo SDK
// modular de cliente que usa apps/web (firebase/*), autenticado como un
// camarero y un cocinero reales. Así cada escritura pasa de verdad por
// firebase/firestore.rules — el mismo patrón "custom-token/password real"
// que ya se usó para verificar COC-06/CAM-07 (ver PROGRESS.md), no un atajo
// de admin.
//
// Dos apps con nombre (como core/firebase-secondary.ts en apps/web) porque
// necesitamos dos sesiones autenticadas distintas a la vez en el mismo
// proceso — una app Firebase = una sesión de Auth.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Copiado de apps/web/src/environments/environment.ts — no es secreto (la
// seguridad real vive en firestore.rules, ver el comentario de ese archivo).
const FIREBASE_CONFIG = {
  projectId: 'mi-plancha',
  appId: '1:612370750966:web:cb5fa7f2a61815f565fbd7',
  storageBucket: 'mi-plancha.firebasestorage.app',
  apiKey: 'AIzaSyBk6J9u0-CQYR0eJeIx9GpJdYhfI0wboj0',
  authDomain: 'mi-plancha.firebaseapp.com',
  messagingSenderId: '612370750966',
};

// Mismo criterio que apps/web/src/app/core/username-email.ts — tiene que
// derivar exactamente el mismo email o el login fallaría.
export function emailSintetico(codigoEmpresa, username) {
  return `${username.trim().toLowerCase()}@${codigoEmpresa.trim().toLowerCase()}.miplancha.local`;
}

/**
 * Inicia sesión como camarero/cocinero de la empresa demo en una app Firebase
 * con nombre propio, y devuelve su instancia de Firestore ya autenticada.
 */
export async function iniciarSesion(nombreApp, codigoEmpresa, username, password) {
  const app = initializeApp(FIREBASE_CONFIG, nombreApp);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const email = emailSintetico(codigoEmpresa, username);
  const credencial = await signInWithEmailAndPassword(auth, email, password);
  return { db, uid: credencial.user.uid };
}
