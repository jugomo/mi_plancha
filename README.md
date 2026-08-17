# mi_plancha

Sistema de gestión de cocina en tiempo real para optimizar el uso de una plancha de carne compartida: maximizar su uso mientras se sirven los pedidos por orden de llegada, con flexibilidad para adelantar pedidos y evitar esperas excesivas.

## Documentación

| Documento | Contenido |
|---|---|
| [`DOMAIN.md`](./DOMAIN.md) | Visión, roles, entidades, flujo funcional, reglas de negocio, alcance del MVP |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Stack técnico, estrategia de coste cero, estructura de monorepo |
| [`ALGORITHM.md`](./ALGORITHM.md) | Algoritmo de sugerencia de cocción |
| [`DATA_MODEL.md`](./DATA_MODEL.md) | Modelo de datos en Firestore, transacciones clave |
| [`USER_STORIES.md`](./USER_STORIES.md) | Historias de usuario por rol, priorizadas P0→P3 |
| [`PROGRESS.md`](./PROGRESS.md) | **Estado actual de la implementación** — empezar por aquí para saber dónde se quedó el proyecto |

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
