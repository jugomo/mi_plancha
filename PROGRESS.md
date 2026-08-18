# Progreso — mi_plancha

Checklist de implementación. Se actualiza en cada sesión de trabajo — es la fuente de verdad del estado del proyecto, independiente de si la conversación de Claude que lo escribió sigue disponible o no.

**Cómo usarlo**: marca `[x]` una historia cuando su código cumple sus criterios de aceptación (`USER_STORIES.md`) y está commiteado. Si una sesión se corta a media historia, dejar una nota bajo "En curso ahora mismo" en vez de marcarla hecha a medias.

## Estado actual

**Fase**: implementación en curso. **P0 y P1 completos** (todo el núcleo operativo + el diferenciador del producto). Falta que el usuario confirme en el navegador las historias de cocinero y P1 (el resto ya está confirmado). Siguiente: P2 (anti-inanición, overflow, división de pedidos) o `apps/ios`/`apps/android`.

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
- [x] ADM-07 — Gestionar usuarios y roles (alta vía app Firebase secundaria para no robar la sesión del admin; cambiar rol/activo inline; autobloqueo de auto-desactivarse/auto-cambiarse el rol — falta confirmación del usuario en el navegador)
- [x] CAM-01 — Abrir una mesa para un cliente (transacción mesa+cliente; falta confirmación del usuario en el navegador)
- [x] CAM-02 — Ver mis mesas en tiempo real (resumen de pedidos pendiente de CAM-03/04; falta confirmación del usuario en el navegador)
- [x] CAM-03 — Crear un pedido para un cliente (todo el pedido va al subgrupo 1 por ahora — la división real es ADM-03, P2; falta confirmación del usuario en el navegador)
- [x] CAM-04 — Ver el estado en tiempo real de un pedido (pantalla de detalle + listado de pedidos por cliente, con alerta de stock bajo; falta confirmación del usuario en el navegador)
- [x] CAM-06 — Generar la cuenta de un cliente (con snapshot de precios; verificado con transacción real end-to-end en un escenario aislado; falta confirmación del usuario en el navegador)
- [x] COC-01 — Ver los pedidos pendientes por prioridad (FIFO simple por ahora — el forzado por anti-inanición es ADM-04/COC-08, P2; falta confirmación del usuario en el navegador)
- [x] COC-03 — Tomar un pedido (exclusividad ya la garantizaban las reglas; falta confirmación del usuario en el navegador)
- [x] COC-04 — Colocar un ingrediente en la plancha (descuenta stock atómicamente; falta confirmación del usuario en el navegador)
- [x] COC-05 — Ver la plancha en tiempo real (capacidad por tipo + temporizadores; sin overflow todavía — COC-07/ADM-05, P2; falta confirmación del usuario en el navegador)
- [x] COC-06 — Marcar un ingrediente como listo (en la misma pantalla del pedido asignado; falta confirmación del usuario en el navegador)

## P1 — El diferenciador del producto

- [x] COC-02 — Ver la sugerencia activa de qué cocinar ahora (algoritmo puro en `core/algoritmo-sugerencia.ts`, verificado de verdad contra los 4 casos de `algorithm-spec/` — primeros tests reales del proyecto, no `it.todo()`; corregidos 2 fallos reales del propio pseudocódigo de ALGORITHM.md en el proceso; falta confirmación del usuario en el navegador)
- [x] CAM-05 — Recibir alerta de stock bajo/agotado (tablero de mesas + detalle de pedido; umbral compartido `UMBRAL_STOCK_BAJO=5` reutilizado también en el CMS de ingredientes; verificado con datos reales — falta confirmación del usuario en el navegador)

## P2 — Ajustes finos del algoritmo y del CMS

- [ ] ADM-04 — Configurar el tiempo máximo de espera (anti-inanición)
- [ ] ADM-05 — Configurar el porcentaje de overflow
- [ ] ADM-03 — Configurar la división de pedidos grandes
- [ ] COC-07 — Activar/desactivar el overflow manualmente
- [ ] COC-08 — Recibir alerta cuando un pedido forzado no cabe

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
