// Instancia secundaria de Firebase, solo para dar de alta cuentas de Auth desde
// el CMS (ADM-07) sin robarle la sesión al administrador que está usando la app:
// `createUserWithEmailAndPassword` inicia sesión automáticamente como el usuario
// recién creado en la instancia de Auth que se le pase, así que se usa una app
// aparte -y se cierra su sesión enseguida- en vez de la principal.
import { getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

import { environment } from '../../environments/environment';

const NOMBRE_APP_SECUNDARIA = 'secundaria-alta-usuarios';

export function authSecundaria(): Auth {
  const existente = getApps().find((a) => a.name === NOMBRE_APP_SECUNDARIA);
  const app = existente ?? initializeApp(environment.firebase, NOMBRE_APP_SECUNDARIA);
  return getAuth(app);
}
