# Progreso — mi_plancha

Checklist de implementación. Se actualiza en cada sesión de trabajo — es la fuente de verdad del estado del proyecto, independiente de si la conversación de Claude que lo escribió sigue disponible o no.

**Cómo usarlo**: marca `[x]` una historia cuando su código cumple sus criterios de aceptación (`USER_STORIES.md`) y está commiteado. Si una sesión se corta a media historia, dejar una nota bajo "En curso ahora mismo" en vez de marcarla hecha a medias.

## Estado actual

**Fase**: especificación completa (`DOMAIN.md`, `ARCHITECTURE.md`, `ALGORITHM.md`, `DATA_MODEL.md`, `firebase/firestore.rules`, `algorithm-spec/`, `USER_STORIES.md`, wireframes) → **arrancando implementación**, empezando por P0.

## En curso ahora mismo

_(vacío — nada a medias todavía)_

## P0 — Núcleo operativo mínimo

- [ ] GEN-01 — Iniciar sesión
- [ ] ADM-01 — Gestionar ingredientes
- [ ] ADM-02 — Configurar la capacidad de la plancha
- [ ] ADM-06 — Configurar el número de mesas
- [ ] ADM-07 — Gestionar usuarios y roles
- [ ] CAM-01 — Abrir una mesa para un cliente
- [ ] CAM-02 — Ver mis mesas en tiempo real
- [ ] CAM-03 — Crear un pedido para un cliente
- [ ] CAM-04 — Ver el estado en tiempo real de un pedido
- [ ] CAM-06 — Generar la cuenta de un cliente
- [ ] COC-01 — Ver los pedidos pendientes por prioridad
- [ ] COC-03 — Tomar un pedido
- [ ] COC-04 — Colocar un ingrediente en la plancha
- [ ] COC-05 — Ver la plancha en tiempo real
- [ ] COC-06 — Marcar un ingrediente como listo

## P1 — El diferenciador del producto

- [ ] COC-02 — Ver la sugerencia activa de qué cocinar ahora
- [ ] CAM-05 — Recibir alerta de stock bajo/agotado

## P2 — Ajustes finos del algoritmo y del CMS

- [ ] ADM-04 — Configurar el tiempo máximo de espera (anti-inanición)
- [ ] ADM-05 — Configurar el porcentaje de overflow
- [ ] ADM-03 — Configurar la división de pedidos grandes
- [ ] COC-07 — Activar/desactivar el overflow manualmente
- [ ] COC-08 — Recibir alerta cuando un pedido forzado no cabe

## P3 — Conveniencia

- [ ] GEN-02 — Ver la app como otro rol (solo lectura)

## Infraestructura (no son historias de usuario, pero bloquean las de arriba)

- [ ] Proyecto Firebase creado (plan Spark) y `firebase init` ejecutado en `firebase/`
- [ ] `apps/web` inicializado (`ng new`)
- [ ] `apps/ios` inicializado (proyecto Xcode)
- [ ] `apps/android` inicializado (proyecto Gradle)
- [ ] Primer administrador dado de alta manualmente en la consola de Firebase (ver `ARCHITECTURE.md`)
