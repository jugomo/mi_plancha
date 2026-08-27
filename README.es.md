# mi_plancha

🇬🇧 English version: [`README.md`](./README.md)

Sistema de gestión de cocina en tiempo real para optimizar el uso de una plancha de carne compartida: maximizar su uso mientras se sirven los pedidos por orden de llegada, con flexibilidad para adelantar pedidos y evitar esperas excesivas.

El desarrollo de este proyecto cuenta con la asistencia de agentes de IA (Claude Code), las apps nativas de iOS y Android se desarrollan de forma manual, con asistencia puntual únicamente.

## Documentación

| Documento | Contenido |
|---|---|
| [`DOMAIN.md`](./DOMAIN.md) | Visión, roles, entidades, flujo funcional, reglas de negocio, alcance del MVP |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Stack técnico, estrategia de coste cero, estructura de monorepo |
| [`ALGORITHM.md`](./ALGORITHM.md) | Algoritmo de sugerencia de cocción |
| [`DATA_MODEL.md`](./DATA_MODEL.md) | Modelo de datos en Firestore, transacciones clave |
| [`USER_STORIES.md`](./USER_STORIES.md) | Historias de usuario por rol, priorizadas P0→P3 |
| [`PROGRESS.md`](./PROGRESS.md) | **Estado actual de la implementación** — empezar por aquí para saber dónde se quedó el proyecto |

## Algoritmo de planificación

Los pedidos se sirven en orden FIFO (por hora de creación), pero la cola no se bloquea: si el pedido que está primero no entra en la capacidad libre de la plancha en ese momento, se lo salta sin detener a los que vienen detrás y sí caben. Esta estrategia se conoce como **backfilling** (habitual en planificadores de trabajos por lotes tipo Slurm/PBS), implementada aquí con una asignación **greedy first-fit**: cada línea de pedido se evalúa en el orden de la cola y entra si cabe en el hueco disponible, sin buscar la combinación óptima que mejor aproveche ese hueco.

Para evitar que un pedido grande quede esperando indefinidamente un hueco lo bastante amplio, existe un mecanismo de **aging**: cuando su tiempo de espera supera el máximo configurado, el pedido pasa a estado "forzado" y se le habilita un margen de overflow como último recurso.

El detalle completo (fórmulas, casos límite, ejemplos) está en [`ALGORITHM.md`](./ALGORITHM.md).

## Estructura del repositorio

```
apps/web/        Angular
apps/ios/         SwiftUI
apps/android/     Kotlin Jetpack Compose
firebase/         Firestore rules, indexes, config (plan Spark, sin coste)
algorithm-spec/   Casos de prueba compartidos del algoritmo de sugerencia
```

Nota: los archivos de configuración de Firebase por cliente (`google-services.json`, `GoogleService-Info.plist`, etc.) se versionan en el repo cuando existan — no son secretos (la seguridad real está en `firebase/firestore.rules`, no en ocultar estas claves).

## Retomar el trabajo

Este proyecto se lleva por sesiones de trabajo con Claude Code. Si retomas después de un tiempo (con o sin memoria de la conversación anterior), el punto de partida es siempre **`PROGRESS.md`**.
