// Entorno compartido por setup.mjs y demo.mjs: crea/reutiliza la empresa
// "Demo script" con su camarero/cocinero/administrador, config, mesas y
// productos de referencia — y, cuando se pide (`limpiar: true`, lo que usa
// siempre demo.mjs), la deja en un estado limpio: borra clientes/pedidos/
// cuentas de una corrida anterior y repone mesas y stock, para que el guion
// siempre arranque sobre un entorno DEMO limpio, sin residuos.
//
// Usa el Admin SDK (bypassa Security Rules), igual que firebase/seed.js —
// aquí es correcto porque solo siembra/limpia datos base; el flujo de
// negocio en sí (demo.mjs) lo ejecuta autenticado como camarero/cocinero
// reales, para que sí pase por las reglas (ver demo.mjs).
import { createRequire } from 'module';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import admin from 'firebase-admin';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', '.demo-empresa.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', '..', '..', 'firebase', 'service-account.json');

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    `Falta ${SERVICE_ACCOUNT_PATH}\n` +
      'Genera la clave desde Firebase Console > Configuración del proyecto > Cuentas de servicio\n' +
      '(mismo requisito que firebase/seed.js — ver firebase/README.md).'
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

export const PASSWORD = 'demo1234';
export const NUM_MESAS = 6;

// Tiempo de cocción real de referencia: minutos. Para la demo se sustituye
// por un valor corto y aleatorio (máx. 5s, distinto en cada `prepararEntorno`)
// para que el temporizador de la plancha en pantalla también vaya rápido —
// ver README.md.
const TIEMPO_COCCION_MAX_SEG = 5;
const tiempoCoccionAleatorio = () => Math.floor(Math.random() * TIEMPO_COCCION_MAX_SEG) + 1;

function productosDeReferencia() {
  return {
    hamburguesa: { nombre: 'Hamburguesa', capacidadUnidad: 10, tiempoCoccionSeg: tiempoCoccionAleatorio(), stock: 34, precio: 4.5 },
    pinchito: { nombre: 'Pinchito', capacidadUnidad: 6, tiempoCoccionSeg: tiempoCoccionAleatorio(), stock: 58, precio: 3.0 },
    montadito: { nombre: 'Montadito', capacidadUnidad: 5, tiempoCoccionSeg: tiempoCoccionAleatorio(), stock: 12, precio: 2.5 },
    // Stock deliberadamente bajo (< UMBRAL_STOCK_BAJO=5 en apps/web) para
    // disparar la alerta de stock bajo de CAM-05 sin configurarlo aparte.
    chorizo: { nombre: 'Chorizo', capacidadUnidad: 8, tiempoCoccionSeg: tiempoCoccionAleatorio(), stock: 3, precio: 3.5 },
    filete: { nombre: 'Filete', capacidadUnidad: 12, tiempoCoccionSeg: tiempoCoccionAleatorio(), stock: 20, precio: 6.0 },
  };
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Mismo criterio que EmpresasService.generarCodigoUnico() en apps/web.
async function generarCodigoUnico() {
  for (;;) {
    const codigo = LETRAS[Math.floor(Math.random() * LETRAS.length)] + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    if (!(await db.doc(`empresas/${codigo}`).get()).exists) return codigo;
  }
}

// `username` solo aplica a camarero/cocinero (login por código de empresa +
// usuario); administrador inicia sesión con email real, sin código (pestaña
// "Administración" de GEN-01) — ver DATA_MODEL.md.
async function crearOReusarUsuario(codigo, { email, username = null, nombre, rol }) {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch {
    user = await admin.auth().createUser({ email, password: PASSWORD });
  }
  await db.doc(`usuarios/${user.uid}`).set(
    { nombre, email, rol, empresaId: codigo, username, activo: true, creadoEn: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return user.uid;
}

async function borrarColeccion(ref) {
  const snap = await ref.get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
}

async function limpiarDatosEnCurso(codigo, productos) {
  const pedidosSnap = await db.collection(`empresas/${codigo}/pedidos`).get();
  for (const pedido of pedidosSnap.docs) {
    await borrarColeccion(db.collection(`empresas/${codigo}/pedidos/${pedido.id}/lineas`));
  }
  await borrarColeccion(db.collection(`empresas/${codigo}/pedidos`));
  await borrarColeccion(db.collection(`empresas/${codigo}/clientes`));
  await borrarColeccion(db.collection(`empresas/${codigo}/cuentas`));

  const batch = db.batch();
  for (let i = 1; i <= NUM_MESAS; i++) {
    batch.set(db.doc(`empresas/${codigo}/mesas/${i}`), { numero: i, estado: 'libre', clienteId: null });
  }
  for (const [id, datos] of Object.entries(productos)) {
    batch.set(db.doc(`empresas/${codigo}/productos/${id}`), datos);
  }
  batch.set(db.doc(`empresas/${codigo}/plancha/estado`), { overflowManualActivo: false, activadoPor: null, activadoEn: null });
  await batch.commit();
}

/**
 * Crea/reutiliza la empresa demo y sus usuarios (mismo código entre
 * corridas, para no tener que volver a iniciar sesión en las pestañas cada
 * vez). Con `limpiar: true` además borra clientes/pedidos/cuentas de una
 * corrida anterior y repone mesas/stock/tiempos de cocción — el "entorno
 * DEMO limpio" que exige cada ejecución de demo.mjs.
 */
export async function prepararEntorno({ limpiar }) {
  let codigo = null;
  if (existsSync(STATE_FILE)) {
    const guardado = JSON.parse(readFileSync(STATE_FILE, 'utf8')).codigo;
    if ((await db.doc(`empresas/${guardado}`).get()).exists) codigo = guardado;
  }

  const nuevaEmpresa = !codigo;
  if (!codigo) {
    codigo = await generarCodigoUnico();
    await db
      .doc(`empresas/${codigo}`)
      .set({ codigo, nombre: 'Demo script', activa: true, creadaEn: FieldValue.serverTimestamp() });
  } else {
    await db.doc(`empresas/${codigo}`).update({ activa: true }); // por si quedó desactivada en una corrida anterior
  }

  const camareroEmail = `camarero1@${codigo.toLowerCase()}.miplancha.local`;
  const cocineroEmail = `cocinero1@${codigo.toLowerCase()}.miplancha.local`;
  // Email real (no sintético): administrador inicia sesión por la pestaña
  // "Administración", con email+contraseña, sin código de empresa.
  const adminEmail = `admin.${codigo.toLowerCase()}@miplancha-demo.local`;

  await crearOReusarUsuario(codigo, { email: camareroEmail, username: 'camarero1', nombre: 'Camarero demo', rol: 'camarero' });
  await crearOReusarUsuario(codigo, { email: cocineroEmail, username: 'cocinero1', nombre: 'Cocinero demo', rol: 'cocinero' });
  await crearOReusarUsuario(codigo, { email: adminEmail, nombre: 'Administrador demo', rol: 'administrador' });

  const batch = db.batch();
  batch.set(db.doc(`empresas/${codigo}/config/plancha`), { capacidadTotal: 100 });
  batch.set(db.doc(`empresas/${codigo}/config/division`), { umbral: 6, tamanoSubgrupo: 3 });
  batch.set(db.doc(`empresas/${codigo}/config/antiInanicion`), { tiempoMaximoEsperaMin: 12 });
  batch.set(db.doc(`empresas/${codigo}/config/overflow`), { porcentaje: 10 });
  batch.set(db.doc(`empresas/${codigo}/config/mesas`), { numeroDeMesas: NUM_MESAS });
  await batch.commit();

  const productos = productosDeReferencia();

  if (limpiar) {
    await limpiarDatosEnCurso(codigo, productos);
  } else {
    // Solo crea lo que falte — no pisa mesas/productos/plancha de una demo
    // en curso si no se ha pedido limpiar explícitamente.
    const mesasSnap = await db.collection(`empresas/${codigo}/mesas`).get();
    if (mesasSnap.size < NUM_MESAS) {
      const b = db.batch();
      for (let i = 1; i <= NUM_MESAS; i++) {
        b.set(db.doc(`empresas/${codigo}/mesas/${i}`), { numero: i, estado: 'libre', clienteId: null }, { merge: true });
      }
      await b.commit();
    }
    const productosSnap = await db.collection(`empresas/${codigo}/productos`).get();
    if (productosSnap.empty) {
      const b = db.batch();
      for (const [id, datos] of Object.entries(productos)) b.set(db.doc(`empresas/${codigo}/productos/${id}`), datos);
      await b.commit();
    }
    if (!(await db.doc(`empresas/${codigo}/plancha/estado`).get()).exists) {
      await db
        .doc(`empresas/${codigo}/plancha/estado`)
        .set({ overflowManualActivo: false, activadoPor: null, activadoEn: null });
    }
  }

  writeFileSync(STATE_FILE, JSON.stringify({ codigo }, null, 2));

  return { codigo, nuevaEmpresa, camareroEmail, cocineroEmail, adminEmail, password: PASSWORD };
}
