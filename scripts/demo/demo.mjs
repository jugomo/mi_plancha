#!/usr/bin/env node
// Dirige un flujo camarero+cocinero completo y realista sobre la empresa
// demo, autenticado como esos dos usuarios reales — cada escritura pasa por
// firebase/firestore.rules, igual que la app de verdad. No toca el DOM ni
// abre ningún navegador: tú tienes dos pestañas ya logueadas (una como
// camarero1, otra como cocinero1 — ver la salida de este mismo script o de
// setup.mjs) y las ves reaccionar solas gracias a los listeners de Firestore
// que ya usa apps/web (onSnapshot).
//
// Cada corrida arranca sobre un entorno DEMO limpio: si quedan clientes,
// pedidos o cuentas de una ejecución anterior, se borran antes de empezar
// (ver lib/entorno.mjs) — así el guion siempre parte del mismo punto.
//
// Uso:
//   npm run demo           # ritmo aleatorio por paso (máx. 5s)
//   npm run demo -- --step # pausa y espera Enter en cada paso, en vez de temporizar
import readline from 'readline';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { iniciarSesion } from './lib/clients.mjs';
import { NUM_MESAS, prepararEntorno } from './lib/entorno.mjs';

const STEP = process.argv.includes('--step');
const PAUSA_MAX_MS = 5000; // "acciones personales" (colocar en plancha, generar cuenta...) — máx. 5s, ver README.md
const PAUSA_RAPIDA_MAX_MS = 1200; // ráfaga de apertura del momento pico — más atropellada que el resto

let codigo; // asignado en main() tras preparar el entorno; las funciones de abajo lo leen por closure

const rl = STEP ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
function preguntar(texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

async function pausa(maxMs = PAUSA_MAX_MS) {
  if (STEP) {
    await preguntar('   ⏸  (Enter para continuar) ');
    return;
  }
  const ms = 200 + Math.random() * (maxMs - 200); // aleatorio, distinto en cada paso
  await new Promise((r) => setTimeout(r, ms));
}

function pausaRapida() {
  return pausa(PAUSA_RAPIDA_MAX_MS);
}

function narrar(actor, mensaje) {
  const icono = actor === 'camarero' ? '🧑‍💼 Camarero' : actor === 'cocinero' ? '🧑‍🍳 Cocinero' : 'ℹ️ ';
  console.log(`${icono}  ${mensaje}`);
}

// El guion del momento pico hace muchas llamadas seguidas a Firestore a lo
// largo de varios minutos — expuesto a un corte de red puntual (visto en la
// práctica: DEADLINE_EXCEEDED a los 60s del RPC, código gRPC transitorio, no
// un fallo de reglas/lógica). `conReintentos` reintenta solo esos códigos de
// transporte, nunca los errores de negocio que lanzamos nosotros mismos más
// abajo (esos no tienen `.code` de Firestore, así que no entran aquí).
const CODIGOS_TRANSITORIOS = new Set(['deadline-exceeded', 'unavailable', 'internal', 'resource-exhausted', 'cancelled']);

async function conReintentos(fn, descripcion, intentosMax = 4) {
  for (let intento = 1; intento <= intentosMax; intento++) {
    try {
      return await fn();
    } catch (err) {
      if (!CODIGOS_TRANSITORIOS.has(err?.code) || intento === intentosMax) throw err;
      console.log(`   ⚠️  ${descripcion}: ${err.code} — reintentando (${intento}/${intentosMax - 1})...`);
      await new Promise((r) => setTimeout(r, 1500 * intento));
    }
  }
}

// ---------- acciones (mismas transacciones que DATA_MODEL.md, ejecutadas
// como el usuario real correspondiente, así que las valida Security Rules) ----------
//
// Cada acción es tolerante a reintento: si un DEADLINE_EXCEEDED deja la
// escritura anterior en un estado ambiguo (¿llegó a commitear en el
// servidor o no?), el reintento primero comprueba el estado actual y, si ya
// está en el punto al que iba a llevarlo, no vuelve a escribir — así no
// duplica ni choca con la Security Rule de turno (que solo permite la
// transición exacta anterior->siguiente, ver firestore.rules).

async function abrirMesa(cam, numeroMesa, nombreCliente) {
  const mesaRef = doc(cam.db, `empresas/${codigo}/mesas/${numeroMesa}`);
  const clienteRef = doc(collection(cam.db, `empresas/${codigo}/clientes`)); // id fijo antes del reintento, para que un reintento no duplique el cliente
  await conReintentos(
    () =>
      runTransaction(cam.db, async (tx) => {
        const mesaSnap = await tx.get(mesaRef);
        if (mesaSnap.data().clienteId === clienteRef.id) return; // ya abierta por un intento anterior
        if (mesaSnap.data().estado !== 'libre') throw new Error(`Mesa ${numeroMesa} no está libre`);
        tx.set(clienteRef, {
          mesaId: String(numeroMesa),
          nombre: nombreCliente,
          camareroId: cam.uid,
          abiertoEn: serverTimestamp(),
        });
        tx.update(mesaRef, { estado: 'ocupada', clienteId: clienteRef.id });
      }),
    `abrir mesa ${numeroMesa}`
  );
  return { id: clienteRef.id, mesaNumero: numeroMesa, nombre: nombreCliente };
}

async function crearPedido(cam, cliente, lineasPedido) {
  const pedidoRef = doc(collection(cam.db, `empresas/${codigo}/pedidos`)); // id fijo antes del reintento
  await conReintentos(
    () =>
      runTransaction(cam.db, async (tx) => {
        tx.set(pedidoRef, {
          clienteId: cliente.id,
          mesaNumero: cliente.mesaNumero,
          clienteNombre: cliente.nombre,
          camareroId: cam.uid,
          cocineroId: null,
          creadoEn: serverTimestamp(),
          subgrupoActual: 1,
          cuentaId: null,
        });
      }),
    `crear pedido de "${cliente.nombre}"`
  );
  const pedidoCreadoEn = (await conReintentos(() => getDoc(pedidoRef), `leer pedido recién creado de "${cliente.nombre}"`)).data().creadoEn;

  const lineas = [];
  for (const { productoId, cantidad } of lineasPedido) {
    const lineaRef = doc(collection(cam.db, `empresas/${codigo}/pedidos/${pedidoRef.id}/lineas`)); // id fijo antes del reintento
    await conReintentos(
      () =>
        runTransaction(cam.db, async (tx) => {
          tx.set(lineaRef, {
            productoId,
            cantidad,
            estado: 'pendiente',
            subgrupo: 1,
            colocadoEn: null,
            retiradoEn: null,
            listoEn: null,
            usandoOverflow: false,
            pedidoCreadoEn,
            cocineroId: null,
            mesaNumero: cliente.mesaNumero,
            empresaId: codigo,
          });
        }),
      `crear línea ${productoId} del pedido de "${cliente.nombre}"`
    );
    lineas.push({ id: lineaRef.id, productoId, cantidad });
  }
  return { id: pedidoRef.id, lineas };
}

async function tomarPedido(coc, pedidoId) {
  const pedidoRef = doc(coc.db, `empresas/${codigo}/pedidos/${pedidoId}`);
  await conReintentos(
    () =>
      runTransaction(coc.db, async (tx) => {
        const actual = (await tx.get(pedidoRef)).data().cocineroId;
        if (actual === coc.uid) return; // ya tomado por este mismo cocinero en un intento anterior
        if (actual !== null) throw new Error('Pedido ya tomado por otro cocinero');
        tx.update(pedidoRef, { cocineroId: coc.uid });
      }),
    `tomar pedido ${pedidoId}`
  );
}

async function colocarEnPlancha(coc, pedidoId, lineaId, productoId) {
  const lineaRef = doc(coc.db, `empresas/${codigo}/pedidos/${pedidoId}/lineas/${lineaId}`);
  const productoRef = doc(coc.db, `empresas/${codigo}/productos/${productoId}`);
  await conReintentos(
    () =>
      runTransaction(coc.db, async (tx) => {
        const lineaSnap = await tx.get(lineaRef);
        const { cantidad, estado } = lineaSnap.data();
        if (estado === 'en_plancha') return; // ya colocada en un intento anterior
        if (estado !== 'pendiente') throw new Error(`La línea ya no está pendiente (estado actual: ${estado})`);
        const productoSnap = await tx.get(productoRef);
        const { stock } = productoSnap.data();
        if (stock < cantidad) throw new Error(`Stock insuficiente de ${productoId} (quedan ${stock})`);
        tx.update(lineaRef, { estado: 'en_plancha', colocadoEn: serverTimestamp() });
        tx.update(productoRef, { stock: stock - cantidad });
      }),
    `colocar ${productoId} en la plancha (pedido ${pedidoId})`
  );
}

async function retirarDePlancha(coc, pedidoId, lineaId) {
  const lineaRef = doc(coc.db, `empresas/${codigo}/pedidos/${pedidoId}/lineas/${lineaId}`);
  await conReintentos(async () => {
    const snap = await getDoc(lineaRef);
    if (snap.data().estado !== 'en_plancha') return; // ya retirada (o más adelante) en un intento anterior
    await updateDoc(lineaRef, { estado: 'pendiente_entrega', retiradoEn: serverTimestamp() });
  }, `retirar línea ${lineaId} de la plancha`);
}

async function confirmarEntrega(cam, pedidoId, lineaId) {
  const lineaRef = doc(cam.db, `empresas/${codigo}/pedidos/${pedidoId}/lineas/${lineaId}`);
  await conReintentos(async () => {
    const snap = await getDoc(lineaRef);
    if (snap.data().estado !== 'pendiente_entrega') return; // ya entregada en un intento anterior
    await updateDoc(lineaRef, { estado: 'listo', listoEn: serverTimestamp() });
  }, `confirmar entrega línea ${lineaId}`);
}

// Dos fases, mismo patrón que CuentasService en apps/web (previsualizarCuenta
// + confirmarCuenta): Transaction.get() del SDK cliente solo acepta una
// DocumentReference, no una colección entera (a diferencia del Admin SDK), así
// que la lectura de líneas/productos para el snapshot de precios no puede ir
// dentro de la transacción — solo los writes finales.
async function generarCuenta(cam, cliente) {
  const clienteRef = doc(cam.db, `empresas/${codigo}/clientes/${cliente.id}`);
  const mesaRef = doc(cam.db, `empresas/${codigo}/mesas/${cliente.mesaNumero}`);

  await conReintentos(async () => {
    if (!(await getDoc(clienteRef)).exists()) return; // ya facturado en un intento anterior

    const pedidosSnap = await getDocs(
      query(collection(cam.db, `empresas/${codigo}/pedidos`), where('clienteId', '==', cliente.id))
    );

    const lineasPorPedido = [];
    for (const pedidoDoc of pedidosSnap.docs) {
      const lineasSnap = await getDocs(collection(pedidoDoc.ref, 'lineas'));
      for (const lineaDoc of lineasSnap.docs) {
        const { productoId, cantidad } = lineaDoc.data();
        lineasPorPedido.push({ pedidoId: pedidoDoc.id, productoId, cantidad });
      }
    }

    const productoIds = [...new Set(lineasPorPedido.map((l) => l.productoId))];
    const productos = new Map();
    for (const id of productoIds) {
      productos.set(id, (await getDoc(doc(cam.db, `empresas/${codigo}/productos/${id}`))).data());
    }

    let total = 0;
    const lineasCuenta = lineasPorPedido.map((l) => {
      const producto = productos.get(l.productoId);
      const subtotal = producto.precio * l.cantidad;
      total += subtotal;
      return {
        pedidoId: l.pedidoId,
        productoNombre: producto.nombre,
        cantidad: l.cantidad,
        precioUnidad: producto.precio,
        subtotal,
      };
    });
    const pedidoIds = pedidosSnap.docs.map((d) => d.id);
    const cuentaRef = doc(collection(cam.db, `empresas/${codigo}/cuentas`));

    await runTransaction(cam.db, async (tx) => {
      if (!(await tx.get(clienteRef)).exists()) return; // carrera con un intento anterior que ya facturó
      tx.set(cuentaRef, {
        mesaNumero: cliente.mesaNumero,
        clienteNombre: cliente.nombre,
        camareroId: cam.uid,
        pedidoIds,
        lineas: lineasCuenta,
        total,
        generadaEn: serverTimestamp(),
      });
      for (const pedidoId of pedidoIds) {
        tx.update(doc(cam.db, `empresas/${codigo}/pedidos/${pedidoId}`), { cuentaId: cuentaRef.id });
      }
      tx.delete(clienteRef);
      tx.update(mesaRef, { estado: 'libre', clienteId: null });
    });
  }, `generar cuenta de "${cliente.nombre}"`);
}

async function mesasLibres(cam, cuantas) {
  const snap = await conReintentos(
    () => getDocs(query(collection(cam.db, `empresas/${codigo}/mesas`), where('estado', '==', 'libre'))),
    'leer mesas libres'
  );
  const numeros = snap.docs.map((d) => d.data().numero).sort((a, b) => a - b);
  if (numeros.length < cuantas) {
    throw new Error(`Hacen falta ${cuantas} mesas libres y solo hay ${numeros.length} — esto no debería pasar recién limpiado el entorno.`);
  }
  return numeros.slice(0, cuantas);
}

// Aplana las líneas de varios pedidos en round-robin (primera línea de cada
// pedido, luego la segunda de los que tengan,...) en vez de agotar un
// pedido antes de pasar al siguiente — así conviven varios pedidos a la vez
// en la plancha, como en un momento pico real, en vez de una cola serial.
function entrelazarLineas(pedidos) {
  const cola = [];
  const maxLineas = Math.max(...pedidos.map((p) => p.lineas.length));
  for (let i = 0; i < maxLineas; i++) {
    for (const pedido of pedidos) {
      if (pedido.lineas[i]) cola.push({ pedido, linea: pedido.lineas[i], etiqueta: pedido.etiquetas[i] });
    }
  }
  return cola;
}

// ---------- guion: momento pico — se llenan todas las mesas casi a la vez ----------

// capacidadTotal de config/plancha (ver lib/entorno.mjs) es 100. Colocar solo
// la primera línea de cada uno de estos 6 pedidos ya suma ~120 unidades de
// capacidad — de sobra para que la plancha se vea a tope (y dispare el aviso
// de "plancha llena"/sugerencia de COC-02/COC-08) antes de que dé tiempo a
// retirar nada. La demanda total de cada producto se mantiene dentro de su
// stock de referencia (ver lib/entorno.mjs) para que ninguna colocación
// falle por falta de stock — salvo el chorizo, que se agota justo a 0
// (1+1+1 = stock de referencia) para demostrar también CAM-05.
const PEDIDOS_PICO = [
  {
    nombre: 'Grupo terraza',
    items: [
      { productoId: 'hamburguesa', cantidad: 2, etiqueta: 'las hamburguesas' },
      { productoId: 'pinchito', cantidad: 3, etiqueta: 'los pinchitos' },
    ],
  },
  {
    nombre: 'Cumpleaños',
    items: [
      { productoId: 'filete', cantidad: 1, etiqueta: 'el filete' },
      { productoId: 'montadito', cantidad: 4, etiqueta: 'los montaditos' },
      { productoId: 'chorizo', cantidad: 1, etiqueta: 'el chorizo' },
    ],
  },
  {
    nombre: 'Oficina',
    items: [
      { productoId: 'hamburguesa', cantidad: 3, etiqueta: 'las hamburguesas' },
      { productoId: 'chorizo', cantidad: 1, etiqueta: 'el chorizo' },
    ],
  },
  {
    nombre: 'Familia numerosa',
    items: [
      { productoId: 'filete', cantidad: 2, etiqueta: 'los filetes' },
      { productoId: 'montadito', cantidad: 3, etiqueta: 'los montaditos' },
    ],
  },
  {
    nombre: 'Amigos',
    items: [
      { productoId: 'pinchito', cantidad: 4, etiqueta: 'los pinchitos' },
      { productoId: 'hamburguesa', cantidad: 2, etiqueta: 'las hamburguesas' },
    ],
  },
  {
    nombre: 'Pareja',
    items: [
      { productoId: 'filete', cantidad: 1, etiqueta: 'el filete' },
      { productoId: 'chorizo', cantidad: 1, etiqueta: 'el chorizo' },
      { productoId: 'pinchito', cantidad: 2, etiqueta: 'los pinchitos' },
    ],
  },
];

async function main() {
  console.log('Preparando entorno DEMO limpio (borra clientes/pedidos/cuentas de una corrida anterior si los hay)...');
  const entorno = await prepararEntorno({ limpiar: true });
  codigo = entorno.codigo;
  console.log(`✓ Empresa demo lista: ${codigo} — mesas y stock repuestos\n`);
  console.log(`Si las pestañas no están logueadas todavía:
  Pestaña "Empresa"          código: ${codigo}   usuario: camarero1   contraseña: ${entorno.password}
  Pestaña "Empresa"          código: ${codigo}   usuario: cocinero1   contraseña: ${entorno.password}
  Pestaña "Administración"   email: ${entorno.adminEmail}   contraseña: ${entorno.password}
`);

  console.log(`Conectando como camarero1 y cocinero1 de la empresa ${codigo}...`);
  const [cam, coc] = await Promise.all([
    conReintentos(() => iniciarSesion('demo-camarero', codigo, 'camarero1', entorno.password), 'iniciar sesión como camarero1'),
    conReintentos(() => iniciarSesion('demo-cocinero', codigo, 'cocinero1', entorno.password), 'iniciar sesión como cocinero1'),
  ]);
  console.log('Conectado. Empieza el guion — mira las dos pestañas.\n');

  if (PEDIDOS_PICO.length !== NUM_MESAS) {
    throw new Error(`PEDIDOS_PICO tiene ${PEDIDOS_PICO.length} grupos pero NUM_MESAS es ${NUM_MESAS} — deberían coincidir`);
  }
  const numerosMesa = await mesasLibres(cam, PEDIDOS_PICO.length);

  narrar('info', `Momento pico: llegan ${PEDIDOS_PICO.length} grupos casi a la vez — se van a llenar todas las mesas (${numerosMesa.join(', ')})`);
  await pausaRapida();

  const pedidos = [];
  for (let i = 0; i < PEDIDOS_PICO.length; i++) {
    const spec = PEDIDOS_PICO[i];
    const numeroMesa = numerosMesa[i];
    narrar('camarero', `abre la mesa ${numeroMesa} para "${spec.nombre}"`);
    const cliente = await abrirMesa(cam, numeroMesa, spec.nombre);
    await pausaRapida();

    const etiquetas = spec.items.map((item) => item.etiqueta);
    narrar('camarero', `pide para "${spec.nombre}": ${etiquetas.join(', ')}`);
    const pedido = await crearPedido(
      cam,
      cliente,
      spec.items.map(({ productoId, cantidad }) => ({ productoId, cantidad }))
    );
    await pausaRapida();

    pedidos.push({ ...pedido, etiquetas, cliente });
  }

  narrar('info', 'Todas las mesas están ocupadas — la cocina tiene 6 pedidos pendientes a la vez');
  await pausa();

  for (const pedido of pedidos) {
    narrar('cocinero', `toma el pedido de "${pedido.cliente.nombre}"`);
    await tomarPedido(coc, pedido.id);
    await pausaRapida();
  }

  narrar('info', 'El cocinero va colocando producto de varios pedidos a la vez, no uno detrás de otro');
  for (const { pedido, linea, etiqueta } of entrelazarLineas(pedidos)) {
    narrar('cocinero', `coloca ${etiqueta} de "${pedido.cliente.nombre}" en la plancha`);
    await colocarEnPlancha(coc, pedido.id, linea.id, linea.productoId);
    await pausa();
  }

  narrar('info', 'La plancha está a tope — toca retirar y servir mientras el resto sigue cociéndose');
  for (const { pedido, linea, etiqueta } of entrelazarLineas(pedidos)) {
    narrar('cocinero', `retira ${etiqueta} de "${pedido.cliente.nombre}" de la plancha`);
    await retirarDePlancha(coc, pedido.id, linea.id);
    await pausa();
    narrar('camarero', `confirma la entrega de ${etiqueta} en la mesa de "${pedido.cliente.nombre}"`);
    await confirmarEntrega(cam, pedido.id, linea.id);
    await pausa();
  }

  for (const pedido of pedidos) {
    narrar('camarero', `genera la cuenta de "${pedido.cliente.nombre}" y libera su mesa`);
    await generarCuenta(cam, pedido.cliente);
    await pausa();
  }

  console.log(`
Fin del guion: los ${pedidos.length} pedidos del momento pico quedaron servidos
y entregados por completo, y las ${pedidos.length} mesas están libres otra vez.

Para volver a verlo: npm run demo   (siempre arranca limpio, no hace falta nada más)
`);
  if (rl) rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nEl guion falló:', err.message ?? err);
  if (rl) rl.close();
  process.exit(1);
});
