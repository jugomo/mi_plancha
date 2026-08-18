# Progreso — mi_plancha

Checklist de implementación. Se actualiza en cada sesión de trabajo — es la fuente de verdad del estado del proyecto, independiente de si la conversación de Claude que lo escribió sigue disponible o no.

**Cómo usarlo**: marca `[x]` una historia cuando su código cumple sus criterios de aceptación (`USER_STORIES.md`) y está commiteado. Si una sesión se corta a media historia, dejar una nota bajo "En curso ahora mismo" en vez de marcarla hecha a medias.

## Estado actual

**Fase**: implementación en curso. **Todas las historias de USER_STORIES.md están construidas** (P0, P1 y P2). El 18 ago se encontró y corrigió un bug real de reglas de Firestore con `collectionGroup` (ver más abajo) que rompía COC-02/COC-05/CAM-05/COC-08 en silencio — las verificaciones previas con Admin SDK no lo detectaban porque ese SDK ignora las Security Rules. Falta que el usuario reconfirme esas cuatro historias en el navegador, más el resto de cocinero y P2. Siguiente: esa confirmación, y luego `apps/ios`/`apps/android`, o el Firebase Emulator Suite para tener tests reales de reglas en vez de scripts manuales.

## En curso ahora mismo

_(vacío — nada a medias todavía)_

## Datos del proyecto Firebase (referencia rápida)

- Project ID: `mi-plancha` (plan Spark, región Firestore `eur3`)
- Apps registradas: Web, iOS (`com.jugomo.miplancha`), Android (`com.jugomo.miplancha`)
- Primer administrador: ya sembrado en `usuarios/`
- `firebase/service-account.json` existe en local (no versionado) — necesario para volver a ejecutar `firebase/seed.js`
- Dos apps huérfanas con bundle/package antiguo (`com.miplancha.app`) pendientes de borrar manualmente desde la consola cuando convenga (no bloquean nada)

## P0 — Núcleo operativo mínimo

- [x] GEN-01 — Iniciar sesión (pendiente de que el usuario confirme login manual en `ng serve` — solo él tiene la contraseña del admin)
- [x] ADM-01 — Gestionar ingredientes (listado + alta + edición + baja; falta que el usuario confirme la UI en el navegador)
- [x] ADM-02 — Configurar la capacidad de la plancha (falta confirmación del usuario en el navegador)
- [x] ADM-06 — Configurar el número de mesas (crea/borra mesas/ en batch atómico; bloquea reducir si alguna mesa sobrante está ocupada — falta confirmación del usuario en el navegador)
- [x] ADM-07 — Gestionar usuarios y roles (alta vía app Firebase secundaria para no robar la sesión del admin; cambiar rol/activo inline; autobloqueo de auto-desactivarse/auto-cambiarse el rol; email visible en la tabla, denormalizado desde Auth — falta confirmación del usuario en el navegador)
- [x] CAM-01 — Abrir una mesa para un cliente (transacción mesa+cliente; falta confirmación del usuario en el navegador)
- [x] CAM-02 — Ver mis mesas en tiempo real (resumen de pedidos: "⏳ Esperando" / "✓ Todo listo" por mesa, añadido tras confirmar el resto — falta confirmación del usuario en el navegador)
- [x] CAM-03 — Crear un pedido para un cliente (todo el pedido va al subgrupo 1 por ahora — la división real es ADM-03, P2; falta confirmación del usuario en el navegador)
- [x] CAM-04 — Ver el estado en tiempo real de un pedido (pantalla de detalle + listado de pedidos por cliente, con alerta de stock bajo; falta confirmación del usuario en el navegador)
- [x] CAM-06 — Generar la cuenta de un cliente (con snapshot de precios; verificado con transacción real end-to-end en un escenario aislado; falta confirmación del usuario en el navegador)
- [x] CAM-07 — Confirmar la entrega de un ingrediente en mesa (botón en el detalle de pedido, solo visible cuando la línea está `pendiente_entrega`; reglas nuevas: solo el camarero responsable del pedido puede hacer esta transición, el cocinero ya no puede — verificado con custom-token real: cocinero rechazado, camarero responsable aceptado; falta confirmación del usuario en el navegador)
- [x] COC-01 — Ver los pedidos pendientes por prioridad (FIFO simple por ahora — el forzado por anti-inanición es ADM-04/COC-08, P2; "Mis pedidos en curso" arriba, luego "Pedidos pendientes" (acordeón, expandido por defecto si hay ≤5) y por último "Pedidos completados" (acordeón); dentro de un pedido completado y ya facturado (`cuentaId` asignado) hay un botón para borrarlo — reglas actualizadas para permitirlo solo en ese caso, verificado con custom-token real: intento sin facturar rechazado, intento facturado con éxito; falta confirmación del usuario en el navegador)
- [x] COC-03 — Tomar un pedido (exclusividad ya la garantizaban las reglas; falta confirmación del usuario en el navegador)
- [x] COC-04 — Colocar un ingrediente en la plancha (descuenta stock atómicamente; falta confirmación del usuario en el navegador)
- [x] COC-05 — Ver la plancha en tiempo real (capacidad por tipo + temporizadores; sin overflow todavía — COC-07/ADM-05, P2; **bug real encontrado y corregido** — ver nota de collectionGroup más abajo; falta confirmación del usuario en el navegador)
- [x] COC-06 — Retirar un ingrediente de la plancha (en la misma pantalla del pedido asignado; nuevo estado intermedio `pendiente_entrega` entre `en_plancha` y `listo` — ver ARCHITECTURE.md; la confirmación de entrega final la hace el camarero, ver CAM-07; reglas actualizadas y verificadas con custom-token real: salto directo `en_plancha`→`listo` rechazado; falta confirmación del usuario en el navegador)

## P1 — El diferenciador del producto

- [x] COC-02 — Ver la sugerencia activa de qué cocinar ahora (algoritmo puro en `core/algoritmo-sugerencia.ts`, verificado de verdad contra los 4 casos de `algorithm-spec/` — primeros tests reales del proyecto, no `it.todo()`; corregidos 2 fallos reales del propio pseudocódigo de ALGORITHM.md en el proceso; **bug real de reglas encontrado y corregido** — ver nota de collectionGroup más abajo; falta confirmación del usuario en el navegador)
- [x] CAM-05 — Recibir alerta de stock bajo/agotado (tablero de mesas + detalle de pedido; umbral compartido `UMBRAL_STOCK_BAJO=5` reutilizado también en el CMS de ingredientes; **bug real de reglas encontrado y corregido** — ver nota de collectionGroup más abajo; falta confirmación del usuario en el navegador)

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

## Infraestructura (no son historias de usuario, pero bloquean las de arriba)

- [x] Proyecto Firebase creado (plan Spark) — `mi-plancha`
- [x] Firestore creado (región `eur3`), reglas e índices desplegados
- [x] Authentication activado (email/contraseña)
- [x] Apps Web/iOS/Android registradas y configs descargadas a `apps/*`
- [x] Primer administrador dado de alta (Auth + `usuarios/{uid}`)
- [x] Config CMS, mesas e ingredientes de referencia sembrados (`firebase/seed.js`)
- [x] `apps/web` inicializado (Angular CLI 22.1.4 — standalone, zone.js, Vitest, SCSS, sin SSR, prefijo `mp`)
- [ ] `apps/ios` inicializado (proyecto Xcode)
- [ ] `apps/android` inicializado (proyecto Gradle)
- [x] Firebase conectado en `apps/web` (SDK modular `firebase`, no `@angular/fire` — sin soporte aún para Angular 22; Firestore/Auth expuestos como `InjectionToken`s en `src/app/core/firebase.providers.ts`)
