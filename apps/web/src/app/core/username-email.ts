// Camarero/cocinero no tienen email real: inician sesión con código de
// empresa + usuario + contraseña (ver DATA_MODEL.md), pero por debajo siguen
// autenticándose con Firebase Auth email+password como todo el mundo — no
// hay otra forma de autenticar en el plan Spark sin backend (ver
// ARCHITECTURE.md). Este email "sintético" se deriva de forma determinista
// de empresa+usuario, así que ni el alta ni el login necesitan una consulta
// previa a Firestore para resolverlo: da igual qué empresa/usuario se
// escriban, el email resultante es siempre el mismo, y Firebase Auth ya
// garantiza que dos altas con el mismo email fallan — eso basta para que un
// username sea único dentro de su empresa, aunque se repita en otra.
const SUFIJO_DOMINIO = 'miplancha.local';

/** Mismo criterio de normalización en el alta (UsuariosService) y en el login (Login). */
export function normalizarUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function emailSintetico(codigoEmpresa: string, username: string): string {
  return `${normalizarUsername(username)}@${codigoEmpresa.trim().toLowerCase()}.${SUFIJO_DOMINIO}`;
}
