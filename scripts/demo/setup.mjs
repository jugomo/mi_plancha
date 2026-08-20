#!/usr/bin/env node
// Crea/reutiliza la empresa demo y muestra las credenciales para loguearte
// en el navegador. La lógica vive en lib/entorno.mjs, compartida con
// demo.mjs (que la invoca siempre con `limpiar: true` — no hace falta correr
// setup.mjs antes de `npm run demo`, este script es solo para ver/recordar
// las credenciales sin tocar una demo en curso).
//
// Uso:
//   npm install
//   npm run setup            # crea/reutiliza la empresa demo, sin tocar datos en curso
//   npm run setup -- --reset # además borra clientes/pedidos/cuentas y repone stock/mesas
import { prepararEntorno } from './lib/entorno.mjs';

const RESET = process.argv.includes('--reset');

async function main() {
  const { codigo, nuevaEmpresa, adminEmail, password } = await prepararEntorno({ limpiar: RESET });

  console.log(nuevaEmpresa ? `✓ Empresa demo creada: ${codigo}` : `✓ Empresa demo reutilizada: ${codigo}`);
  console.log('✓ Usuarios camarero1 / cocinero1 / administrador demo listos');
  console.log('✓ Config, mesas y productos de referencia listos');
  if (RESET) {
    console.log('✓ --reset: clientes/pedidos/cuentas de una corrida anterior borrados, mesas y stock repuestos');
  }

  console.log(`
Listo. Abre pestañas en la web (npm start dentro de apps/web, o la URL de
Hosting si ya está desplegada) e inicia sesión en cada una:

  Pestaña "Empresa"          código: ${codigo}   usuario: camarero1        contraseña: ${password}
  Pestaña "Empresa"          código: ${codigo}   usuario: cocinero1        contraseña: ${password}
  Pestaña "Administración"   email: ${adminEmail}   contraseña: ${password}

Con camarero1 y cocinero1 logueados, ejecuta:  npm run demo
(la pestaña de administrador es solo para mirar el CMS — demo.mjs no la usa)
`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('setup.mjs falló:', err);
    process.exit(1);
  });
