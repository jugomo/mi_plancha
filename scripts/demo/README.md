# Demo dirigida — camarero + cocinero en vivo

Dos scripts Node para ver el flujo P0 (`DOMAIN.md`/`USER_STORIES.md`) actuar
solo, mientras tú miras dos pestañas del navegador ya logueadas — una como
camarero, otra como cocinero. No abren ni controlan ningún navegador: solo
escriben en Firestore autenticados como esos dos usuarios reales, y las
pestañas reaccionan por su cuenta gracias a los `onSnapshot` que ya usa
`apps/web`.

Por qué autenticados "de verdad" (no con el Admin SDK): así cada escritura
pasa por `firebase/firestore.rules` de verdad, igual que el patrón de
`custom-token real` ya usado para verificar COC-06/CAM-07 (ver
`PROGRESS.md`) — si algo se rompiera aquí, sería la misma clase de bug real
que ya se encontró una vez con `collectionGroup`.

## Requisitos

- `firebase/service-account.json` (mismo que pide `firebase/seed.js` — ver
  `firebase/README.md`).
- Node 18+.

## Uso

```bash
cd scripts/demo
npm install

npm run demo
# Prepara un entorno DEMO limpio (crea/reutiliza la empresa "Demo script"
# con camarero1/cocinero1/administrador demo, y si quedan clientes/pedidos/
# cuentas de una corrida anterior los borra) y ejecuta un "momento pico":
# llegan 6 grupos casi a la vez y se llenan TODAS las mesas (NUM_MESAS=6 en
# lib/entorno.mjs), el cocinero toma los 6 pedidos y va colocando/retirando
# producto de varios a la vez —entrelazado, no uno detrás de otro— hasta
# saturar la plancha (la primera ronda ya suma más que capacidadTotal=100,
# así que se ve a tope y puede disparar el aviso de "plancha llena" de
# COC-02/COC-08). Termina siempre con los 6 pedidos servidos y entregados
# del todo, y las 6 mesas libres otra vez.
```

La primera vez que corras `npm run demo`, imprime las credenciales antes de
empezar — abre pestañas en la web (`npm start` dentro de `apps/web`) e inicia
sesión con ellas mientras el guion corre (el código de empresa no cambia
entre corridas, así que solo hace falta loguearse una vez).

Flags:

- `--step` — en vez de temporizar, pausa y espera que pulses Enter en cada
  paso (útil para narrar en directo). Sin este flag, cada paso espera un
  tiempo aleatorio de hasta 5s — igual que los tiempos de cocción de los
  productos de referencia (también aleatorios, ≤5s, para que el
  temporizador de la plancha en pantalla vaya al mismo ritmo que el guion).

Para solo crear/consultar la empresa demo sin ejecutar el guion (por
ejemplo, para recuperar las credenciales sin tocar una demo en curso):

```bash
npm run setup            # crea/reutiliza la empresa, sin borrar nada en curso
npm run setup -- --reset # además borra clientes/pedidos/cuentas y repone stock/mesas
```

## Qué NO toca

Todo vive dentro de su propia `empresas/{código}` (multi-empresa, ver
`DATA_MODEL.md`) — no lee ni escribe ninguna otra empresa de tu Firestore.
La limpieza/siembra (`lib/entorno.mjs`) usa el Admin SDK; `demo.mjs` actúa
siempre como camarero1/cocinero1 autenticados, nunca como admin.

## Extender el guion

`demo.mjs` es una lista de pasos (`abrirMesa`, `crearPedido`, `tomarPedido`,
`colocarEnPlancha`, `retirarDePlancha`, `confirmarEntrega`, `generarCuenta`)
que reproducen exactamente las transacciones de `DATA_MODEL.md`. Para armar
otro escenario (p. ej. los casos "golden" de `algorithm-spec/`: overflow
automático, overflow manual, división de pedidos grandes) basta con llamar a
esas mismas funciones en otro orden/cantidades — no hace falta tocar
`lib/clients.mjs` ni `lib/entorno.mjs`.
