# Progreso — mi_plancha

Checklist de implementación. Se actualiza en cada sesión de trabajo — es la fuente de verdad del estado del proyecto, independiente de si la conversación de Claude que lo escribió sigue disponible o no.

**Cómo usarlo**: marca `[x]` una historia cuando su código cumple sus criterios de aceptación (`USER_STORIES.md`) y está commiteado. Si una sesión se corta a media historia, dejar una nota bajo "En curso ahora mismo" en vez de marcarla hecha a medias.

## Estado actual

**Fase**: implementación en curso. El 19 ago se hizo el retrofit **multi-empresa**
(`empresas/{codigo}` por encima de todo, rol `superadmin` sobre el `administrador` ahora
acotado a una empresa, login de camarero/cocinero por código+usuario — ver DOMAIN.md /
DATA_MODEL.md / USER_STORIES.md `SA-*`). Código y reglas escritos y compilando; **falta**:
desplegar `firestore:rules,firestore:indexes`, ejecutar el script de migración que
elimina los datos de prueba viejos (single-tenant) y convierte la cuenta de Julio a
superadmin, y confirmar el flujo completo en el navegador contra Firestore real (no
Admin SDK — ver la lección del bug de collectionGroup más abajo). Antes de este cambio,
todas las historias de P0/P1/P2 ya estaban construidas (varias con confirmación
pendiente del usuario en el navegador, como se detalla fila por fila más abajo).

## En curso ahora mismo

_(vacío — nada a medias todavía)_

## Datos del proyecto Firebase (referencia rápida)

- Project ID: `mi-plancha` (plan Spark, región Firestore `eur3`)
- Apps registradas: Web, iOS (`com.jugomo.miplancha`), Android (`com.jugomo.miplancha`)
- Primer superadmin: la cuenta de Julio (antes único administrador) — **pendiente** el script
  de migración que la convierte (`rol: 'superadmin'`, `empresaId: null`) y borra los datos
  de prueba del modelo single-tenant viejo (mesas/clientes/pedidos/cuentas/productos/config
  en la raíz, y los 4 usuarios camarero/cocinero de prueba con sus cuentas de Auth) — se
  elimina en vez de migrarse, por decisión explícita del usuario.
- `firebase/service-account.json` existe en local (no versionado) — usado para el script de
  migración de arriba (`firebase/seed.js` queda obsoleto para el modelo actual, ver
  `firebase/README.md`)
- Dos apps huérfanas con bundle/package antiguo (`com.miplancha.app`) pendientes de borrar manualmente desde la consola cuando convenga (no bloquean nada)

## P0 — Núcleo operativo mínimo

- [x] GEN-01 — Iniciar sesión (dos pestañas: "Empresa" código+usuario+contraseña para camarero/cocinero, "Administración" email+contraseña para administrador/superadmin — falta confirmación del usuario en el navegador tras el retrofit multi-empresa)
- [x] SA-01 — Crear una empresa con su administrador (código único autogenerado `[A-Z][0-9]{3}`, alta combinada empresa+admin en un formulario, reutiliza el patrón de app Firebase secundaria de ADM-07 — falta confirmación en el navegador)
- [x] SA-02 — Activar/desactivar una empresa (`Sesion` escucha `empresas/{id}.activa` en tiempo real y cierra sesión si pasa a `false`, igual que ya hacía con `usuarios/{uid}.activo` — falta confirmación en el navegador)
- [x] SA-03 — Gestionar el administrador de cualquier empresa (listado cross-empresa, activar/desactivar; sin borrado de administradores, solo de camarero/cocinero — falta confirmación en el navegador)
- [x] SA-04 — Gestionar camarero/cocinero de cualquier empresa (mismo listado, con selector de empresa al invitar y columna de empresa en la tabla — falta confirmación en el navegador)
- [x] ADM-01 — Gestionar productos (listado + alta + edición + baja; falta que el usuario confirme la UI en el navegador)
- [x] ADM-02 — Configurar la capacidad de la plancha (falta confirmación del usuario en el navegador)
- [x] ADM-06 — Configurar el número de mesas (crea/borra mesas/ en batch atómico; bloquea reducir si alguna mesa sobrante está ocupada — falta confirmación del usuario en el navegador)
- [x] ADM-07 — Gestionar camarero/cocinero de mi empresa (reescrita para multi-empresa: ya no puede crear otro administrador, alta por usuario/contraseña en vez de email, nuevo borrado además de activar/desactivar; la fila del propio admin ya no aparece en su lista — no hace falta protección de "no te toques a ti mismo" aquí, sí sigue en la lista cross-empresa del superadmin — falta confirmación del usuario en el navegador)
- [x] CAM-01 — Abrir una mesa para un cliente (transacción mesa+cliente; falta confirmación del usuario en el navegador)
- [x] CAM-02 — Ver mis mesas en tiempo real (resumen de pedidos por mesa: "⏳ Esperando" / "🔥 En plancha" / "🍽 Pendiente entrega en mesa" / "✓ Todo listo" — antes solo distinguía esperando/todo listo, ampliado porque en el dashboard no se veía el estado "En plancha" que sí se ve en el detalle de pedido; el fondo de cada tarjeta de mesa ahora también cambia de color según ese mismo estado, no solo el texto del chip; falta confirmación del usuario en el navegador)
- [x] CAM-03 — Crear un pedido para un cliente (todo el pedido va al subgrupo 1 por ahora — la división real es ADM-03, P2; falta confirmación del usuario en el navegador)
- [x] CAM-04 — Ver el estado en tiempo real de un pedido (pantalla de detalle + listado de pedidos por cliente, con alerta de stock bajo; el chip de estado agregado del pedido usa vocabulario propio del overview — Esperando / Cocinando / Pendiente entrega en mesa / Entregado, ver ARCHITECTURE.md — derivado en tiempo real de `cocineroId` + las líneas; ahora también visible por pedido en el listado de pedidos del cliente, no solo dentro del detalle — `calcularEstadoPedidoVista`/`etiquetaEstadoPedidoVista` se movieron a `pedidos.service.ts` para no duplicar la lógica entre las dos pantallas; falta confirmación del usuario en el navegador)
- [x] CAM-06 — Generar la cuenta de un cliente (con snapshot de precios; verificado con transacción real end-to-end en un escenario aislado; **bug real encontrado y corregido**: un cliente que abrió mesa sin hacer ningún pedido dejaba el botón de "Generar cuenta" permanentemente deshabilitado, sin forma de liberar la mesa — ahora, sin pedidos, la pantalla ofrece "Cerrar mesa" en su lugar, que libera la mesa sin crear un registro vacío en `cuentas/`; verificado con transacción real como camarero autenticado; falta confirmación del usuario en el navegador)
- [x] CAM-07 — Confirmar la entrega de un producto en mesa (botón en el detalle de pedido, solo visible cuando la línea está `pendiente_entrega`; reglas nuevas: solo el camarero responsable del pedido puede hacer esta transición, el cocinero ya no puede — verificado con custom-token real: cocinero rechazado, camarero responsable aceptado; falta confirmación del usuario en el navegador)
- [x] COC-01 — Ver los pedidos pendientes por prioridad (FIFO simple por ahora — el forzado por anti-inanición es ADM-04/COC-08, P2; "Mis pedidos en curso" arriba (cada card con chip de estado — Cocinando / Pendiente entrega en mesa, mismo `calcularEstadoPedidoVista` compartido con el camarero), debajo "Pedidos pendientes" (acordeón, expandido por defecto si hay ≤5); "Pedidos completados" ya no vive aquí — se movió a su propia pantalla (`/cocinero/completados`), con un botón dedicado en la barra de navegación Pendientes/Plancha, alineado a la derecha para distinguirlo visualmente de las dos pestañas; el botón para borrar un pedido completado y ya facturado (`cuentaId` asignado) sigue ahí — reglas verificadas con custom-token real: intento sin facturar rechazado, intento facturado con éxito; falta confirmación del usuario en el navegador)
- [x] COC-03 — Tomar un pedido (exclusividad ya la garantizaban las reglas; falta confirmación del usuario en el navegador)
- [x] COC-04 — Colocar un producto en la plancha (descuenta stock atómicamente; falta confirmación del usuario en el navegador)
- [x] COC-05 — Ver la plancha en tiempo real (capacidad por tipo + temporizadores; sin overflow todavía — COC-07/ADM-05, P2; **bug real encontrado y corregido** — ver nota de collectionGroup más abajo; falta confirmación del usuario en el navegador)
- [x] COC-06 — Retirar un producto de la plancha (en la misma pantalla del pedido asignado; nuevo estado intermedio `pendiente_entrega` entre `en_plancha` y `listo` — ver ARCHITECTURE.md; la confirmación de entrega final la hace el camarero, ver CAM-07; reglas actualizadas y verificadas con custom-token real: salto directo `en_plancha`→`listo` rechazado; falta confirmación del usuario en el navegador)

## P1 — El diferenciador del producto

- [x] COC-02 — Ver la sugerencia activa de qué cocinar ahora (algoritmo puro en `core/algoritmo-sugerencia.ts`, verificado de verdad contra los 4 casos de `algorithm-spec/` — primeros tests reales del proyecto, no `it.todo()`; corregidos 2 fallos reales del propio pseudocódigo de ALGORITHM.md en el proceso; **bug real de reglas encontrado y corregido** — ver nota de collectionGroup más abajo; falta confirmación del usuario en el navegador)
- [x] CAM-05 — Recibir alerta de stock bajo/agotado (tablero de mesas + detalle de pedido; umbral compartido `UMBRAL_STOCK_BAJO=5` reutilizado también en el CMS dy productos; **bug real de reglas encontrado y corregido** — ver nota de collectionGroup más abajo; falta confirmación del usuario en el navegador)

## P2 — Ajustes finos del algoritmo y del CMS

- [x] ADM-04 — Configurar el tiempo máximo de espera (anti-inanición) — falta confirmación del usuario en el navegador
- [x] ADM-05 — Configurar el porcentaje de overflow — falta confirmación del usuario en el navegador
- [x] ADM-03 — Configurar la división de pedidos grandes (solo el CMS; el pedido en sí sigue yendo entero al subgrupo 1 al crearlo — CAM-03 no divide todavía, ver DOMAIN.md) — falta confirmación del usuario en el navegador
- [x] COC-07 — Activar/desactivar el overflow manualmente (toggle compartido en la pantalla de la plancha; de paso, la barra de capacidad ya se extiende visualmente más allá del 100% — cerraba un pendiente de COC-05) — falta confirmación del usuario en el navegador
- [x] COC-08 — Recibir alerta cuando un pedido forzado no cabe (ya salía como efecto colateral de COC-02; hoy la hice legible con la mesa en vez del id interno de Firestore) — falta confirmación del usuario en el navegador

## Bug real encontrado y corregido (18 ago): collectionGroup + reglas anidadas

El usuario reportó "Ver pedidos" sin reaccionar en el navegador. Las reglas anidadas
`match /pedidos/{pedidoId}/lineas/{lineaId}` **no se aplican a `collectionGroup('lineas')`**
— solo gobiernan lecturas sobre la subcolección de un pedido concreto. Rompía en
silencio `PlanchaService.enPlancha()` (COC-05), `SugerenciaService.lineasPendientes()`
(COC-02/COC-08) y `AlertasStockService.mesasConAlerta()` (CAM-05) — las tres usan
collection group queries. Arreglado añadiendo `match /{path=**}/lineas/{lineaId}` en
`firebase/firestore.rules`.

**Por qué no se detectó en las verificaciones anteriores**: todas las comprobaciones
de esas historias se hicieron con el **Admin SDK** (`firebase/service-account.json`),
que **ignora las Security Rules por completo**. Validaba forma de los datos e índices,
pero no permisos reales. Para probar permisos de verdad hace falta el SDK de cliente
autenticado como un usuario real — aquí se hizo con `admin.auth().createCustomToken()`
+ `signInWithCustomToken()` en un script puntual (no se guarda, ver más abajo). El
Firebase Emulator Suite (pendiente, ver Infraestructura) automatizaría esto en vez de
depender de scripts manuales cada vez.

## P3 — Conveniencia

- [ ] GEN-02 — Ver la app como otro rol (solo lectura)
- [x] CAM-08 — Ver mis pedidos completados (pantalla nueva `/camarero/completados`, con un botón dedicado en la cabecera del panel de mesas, junto a "+ Abrir mesa"; nuevo `PedidosService.pedidosDeCamarero()` + índice compuesto `camareroId + creadoEn` — desplegado y verificado con custom-token real que la query funciona sin error de índice; solo lectura, sin borrar — eso sigue siendo cosa del cocinero en COC-01; falta confirmación del usuario en el navegador)

## Infraestructura (no son historias de usuario, pero bloquean las de arriba)

- [x] Proyecto Firebase creado (plan Spark) — `mi-plancha`
- [x] Firestore creado (región `eur3`)
- [ ] Reglas e índices del modelo multi-empresa desplegados (reescritos en esta sesión —
      `firebase deploy --only firestore:rules,firestore:indexes`, pendiente de ejecutar)
- [x] Authentication activado (email/contraseña; camarero/cocinero usan un email sintético
      por debajo, ver DATA_MODEL.md — sigue siendo email/contraseña de cara a Firebase Auth)
- [x] Apps Web/iOS/Android registradas y configs descargadas a `apps/*`
- [x] Primer administrador dado de alta (Auth + `usuarios/{uid}`) — pendiente migrarlo a superadmin
- [ ] Config CMS, mesas y productos de referencia sembrados para al menos una empresa
      real (el `seed.js` viejo ya no aplica, ver `firebase/README.md`; se hace desde el
      propio CMS de cada administrador, no por seed)
- [x] `apps/web` inicializado (Angular CLI 22.1.4 — standalone, zone.js, Vitest, SCSS, sin SSR, prefijo `mp`)
- [ ] `apps/ios` inicializado (proyecto Xcode)
- [ ] `apps/android` inicializado (proyecto Gradle)
- [x] Firebase conectado en `apps/web` (SDK modular `firebase`, no `@angular/fire` — sin soporte aún para Angular 22; Firestore/Auth expuestos como `InjectionToken`s en `src/app/core/firebase.providers.ts`)
