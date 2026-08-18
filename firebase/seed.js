// Script de bootstrap del proyecto Firebase: crea el primer administrador y los
// datos de configuración base del CMS (ver ../DATA_MODEL.md).
//
// Requiere una service account key en ./service-account.json — se genera desde
// Firebase Console > Configuración del proyecto > Cuentas de servicio > "Generar
// nueva clave privada". NUNCA se commitea (ver .gitignore).
//
// Uso:
//   npm install
//   npm run seed

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// --- Ajustar antes de ejecutar ---
const ADMIN_UID = process.env.ADMIN_UID;
const ADMIN_NOMBRE = process.env.ADMIN_NOMBRE;
const NUMERO_DE_MESAS = 12;

// Ingredientes de referencia — los mismos usados en ALGORITHM.md, algorithm-spec/
// y los wireframes, para poder probar el resto del sistema con datos conocidos.
const INGREDIENTES = {
  hamburguesa: { nombre: 'Hamburguesa', capacidadUnidad: 10, tiempoCoccionSeg: 360, stock: 34, precio: 4.5 },
  pinchito: { nombre: 'Pinchito', capacidadUnidad: 6, tiempoCoccionSeg: 240, stock: 58, precio: 3.0 },
  montadito: { nombre: 'Montadito', capacidadUnidad: 5, tiempoCoccionSeg: 180, stock: 12, precio: 2.5 },
  chorizo: { nombre: 'Chorizo', capacidadUnidad: 8, tiempoCoccionSeg: 420, stock: 3, precio: 3.5 },
  filete: { nombre: 'Filete', capacidadUnidad: 12, tiempoCoccionSeg: 300, stock: 20, precio: 6.0 },
};

async function seed() {
  const batch = db.batch();

  // Primer administrador (bootstrap manual, ver ARCHITECTURE.md). El email se
  // resuelve desde Auth (no hace falta mantenerlo a mano aquí) — ver ADM-07.
  const adminAuth = await admin.auth().getUser(ADMIN_UID);
  batch.set(db.doc(`usuarios/${ADMIN_UID}`), {
    nombre: ADMIN_NOMBRE,
    email: adminAuth.email,
    rol: 'administrador',
    activo: true,
    creadoEn: FieldValue.serverTimestamp(),
  });

  // Config CMS.
  batch.set(db.doc('config/plancha'), { capacidadTotal: 100 });
  batch.set(db.doc('config/division'), { umbral: 6, tamanoSubgrupo: 3 });
  batch.set(db.doc('config/antiInanicion'), { tiempoMaximoEsperaMin: 12 });
  batch.set(db.doc('config/overflow'), { porcentaje: 10 });
  batch.set(db.doc('config/mesas'), { numeroDeMesas: NUMERO_DE_MESAS });

  // Estado operativo de la plancha (no confundir con config/plancha).
  batch.set(db.doc('plancha/estado'), {
    overflowManualActivo: false,
    activadoPor: null,
    activadoEn: null,
  });

  // Mesas, todas libres al arrancar.
  for (let i = 1; i <= NUMERO_DE_MESAS; i++) {
    batch.set(db.doc(`mesas/${i}`), { numero: i, estado: 'libre', clienteId: null });
  }

  // Ingredientes de referencia.
  for (const [id, datos] of Object.entries(INGREDIENTES)) {
    batch.set(db.doc(`ingredientes/${id}`), datos);
  }

  await batch.commit();
  console.log('Seed completado: administrador, config, mesas e ingredientes creados.');
}

seed().catch((err) => {
  console.error('Seed falló:', err);
  process.exit(1);
});
