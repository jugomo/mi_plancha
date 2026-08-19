# Arquitectura — mi_plancha

Para el modelo de dominio (roles, entidades, flujo funcional, reglas de negocio), ver [DOMAIN.md](./DOMAIN.md).

## Interfaces

- **Web app**: Angular.
- **App móvil**: nativas — SwiftUI (iOS) y Kotlin Jetpack Compose (Android). Mismas pantallas y funcionalidad por rol que la web; el usuario elige indistintamente cuál usar.
- **CMS** (dentro del rol administrador): gestión de productos (capacidad, tiempo de cocción, stock), capacidad total de la plancha, umbral/tamaño de división de pedidos, y tiempo máximo de espera por pedido (regla anti-inanición).
- **Backend/API**: **Firebase, exclusivamente en el plan Spark (gratuito)** — Firestore + Firebase Authentication + Firebase Hosting. Recomendado sobre AWS Lambda o Vercel para este caso porque:
  - Firestore ofrece listeners en tiempo real de forma nativa (clave para sincronizar pedidos/estado de plancha entre 3 clientes distintos: web Angular, iOS SwiftUI, Android Jetpack Compose) sin montar infraestructura de websockets aparte.
  - Tiene SDKs oficiales para los tres stacks elegidos (JS/Angular, Swift, Kotlin).
  - Firebase Hosting sirve la web Angular sin coste, dentro del plan Spark.
  - **Vercel** no encaja con el requisito de coste cero para este proyecto: su plan **Hobby (gratuito)** está limitado por sus términos de servicio a uso **personal/no comercial** — al ser una app para un negocio de comida, un despliegue de producción ahí requeriría su plan Pro (de pago). Además no aporta tiempo real nativo ni SDKs móviles (habría que añadir websockets/Pusher aparte).
  - **AWS Lambda** es viable técnicamente, pero exige más piezas de infraestructura (API Gateway WebSocket, DynamoDB Streams) para igualar el tiempo real de Firestore, y su capa gratuita requiere tarjeta de crédito asociada a la cuenta desde el alta — aunque el consumo se mantenga en el tramo gratuito, hay una tarjeta en juego, lo que no encaja con "cero inversión en infraestructura".

> **Nota de la versión anterior de este documento**: se había propuesto Cloud Functions para la lógica de servidor. Se descarta para el MVP — ver "Estrategia de coste cero" abajo.

## Estrategia de coste cero (Firebase Spark)

Requisito del usuario: el MVP no debe requerir tarjeta de crédito ni plan de pago. Esto descarta **Cloud Functions**, porque Firebase exige activar el plan **Blaze** (pago por uso, con tarjeta asociada) para poder desplegar cualquier función, aunque el consumo real se quede en la franja gratuita. Ajustes derivados de esta decisión:

- **Sin Cloud Functions**: toda la lógica de negocio (algoritmo de sugerencia, validaciones de stock/capacidad, transiciones de estado) se ejecuta **en el cliente** (Angular / SwiftUI / Jetpack Compose), leyendo y escribiendo directamente en Firestore. Es viable porque el cocinero siempre valida manualmente la sugerencia — no hace falta un cálculo "de confianza" en servidor para el MVP.
- **Operaciones atómicas sin servidor**: las acciones que deben ser exclusivas o consistentes (asignar un pedido a un cocinero, descontar stock al poner un producto en la plancha) se implementan con **transacciones de Firestore** desde el SDK cliente, que garantizan atomicidad sin necesidad de un backend intermedio.
- **Roles sin custom claims**: los custom claims de Firebase Auth normalmente se asignan con el Admin SDK (server-side), lo que de nuevo requeriría un backend. En su lugar, el rol de cada usuario se guarda como campo en un documento Firestore (`usuarios/{uid}`), y las **Security Rules** lo consultan con `get()` para autorizar cada lectura/escritura según rol (camarero/cocinero/administrador/superadmin) y empresa, y según las reglas de negocio (ej. "solo el cocinero asignado puede completar su pedido", "el stock no puede quedar negativo").
- **Login de camarero/cocinero sin backend**: el modelo multi-empresa (ver `DOMAIN.md`/`DATA_MODEL.md`) le pide a camarero/cocinero un código de empresa además de usuario/contraseña, pero Firebase Auth solo sabe autenticar con email+password. En vez de resolver el email real con una consulta a Firestore antes de autenticar (que además tendría que ser de lectura pública, sin sesión), se deriva un email **sintético** determinista a partir de empresa+usuario (`core/username-email.ts`) — mismo mecanismo cliente-only que el resto del sistema, sin backend ni lookup previo.
- **Bootstrap del primer superadmin**: al no haber backend, la primera cuenta de superadmin se crea manualmente (alta directa en la consola de Firebase o escritura puntual del documento `usuarios/{uid}`, con `rol: 'superadmin'` y `empresaId: null`) como paso único de configuración inicial; a partir de ahí, el superadmin crea empresas (con su administrador dedicado) desde el CMS, y cada administrador gestiona después su propio personal.
- **Sin notificaciones push**: enviar mensajes vía FCM normalmente requiere un servidor (Admin SDK). Para el MVP basta con alertas visuales en pantalla alimentadas por los listeners en tiempo real de Firestore (todas las pantallas de cocina/camarero están siempre visibles).
- **Autenticación**: usar email/contraseña (o Google Sign-In) para las cuentas de personal. Se evita la autenticación por teléfono/SMS, que tiene coste asociado incluso en cuentas sin plan Blaze activado.
- **Cuotas gratuitas del plan Spark a vigilar** (más que suficientes para un único local en el MVP): Firestore — 1 GiB almacenamiento, 50K lecturas/día, 20K escrituras/día, 20K borrados/día, 10 GiB/mes de transferencia; Hosting — 10 GB almacenamiento, 360 MB/día de transferencia; Authentication — gratuita para email/contraseña y proveedores OAuth estándar.
- **Camino de evolución futuro**: si el negocio crece (varios locales, se necesita lógica de servidor de confianza, notificaciones push, mayor volumen de escrituras), se puede activar el plan Blaze más adelante — mantiene las mismas cuotas gratuitas y solo cobra por lo que las exceda, y permite fijar un tope de gasto diario. No es una decisión que haga falta tomar ahora.

## Estructura del repositorio: monorepo

El proyecto se organiza como **un único repositorio** con los tres clientes, la configuración de Firebase y la documentación, en vez de repos separados:

```
mi_plancha/
├── apps/
│   ├── web/          # Angular
│   ├── ios/           # SwiftUI
│   └── android/       # Kotlin Jetpack Compose
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── firebase.json
├── algorithm-spec/    # casos de prueba ("golden cases") del algoritmo de sugerencia,
│                       # en un formato neutral (ej. JSON) que las tres apps consumen
│                       # en sus propios tests — ver ALGORITHM.md
└── *.md                # DOMAIN.md, ARCHITECTURE.md, ALGORITHM.md, DATA_MODEL.md
```

Matices importantes, porque Angular/SwiftUI/Compose no comparten toolchain (no hay un grafo de build único tipo Nx/Turborepo que los una):

- No es un monorepo "con herramientas" (sin build system compartido entre npm, Xcode y Gradle) — es, ante todo, **una única fuente de verdad**: un commit puede tocar a la vez la regla de Firestore, el modelo de datos y los tres clientes que dependen de ella, en un solo PR.
- El ganador real de esta estructura es `algorithm-spec/`: los mismos casos de prueba (ver el ejemplo numérico de `ALGORITHM.md`) se versionan una vez y cada app los consume en su propio framework de test, evitando que las tres implementaciones del algoritmo diverjan sin que nadie se entere.
- `firestore.rules` y la configuración de Firebase viven junto al código que las usa, no en un repo aparte.

## Máquina de estados de una línea de pedido

Cada línea de pedido (`pedidos/{id}/lineas/{id}`, ver [DATA_MODEL.md](./DATA_MODEL.md)) recorre cuatro estados, en secuencia estricta. Las dos primeras transiciones las dispara el cocinero; la última, el camarero — es el único tramo de la secuencia que cambia de rol:

```
pendiente ──(cocinero: poner en plancha)──> en_plancha ──(cocinero: retirar de la plancha)──> pendiente_entrega ──(camarero: confirmar entrega en mesa)──> listo
```

- **`pendiente`**: todavía no se ha colocado el producto en la plancha.
- **`en_plancha`**: colocado y cociéndose; arranca el temporizador de cocción (`colocadoEn` + `tiempoCoccionSeg` del producto).
- **`pendiente_entrega`**: el cocinero ya retiró el producto de la plancha (decisión visual suya, no automática — ver `DOMAIN.md`), pero todavía no ha llegado a la mesa. Es un estado intermedio explícito para diferenciar "ya está cocinado" de "ya está en la mesa": antes de introducirlo, ambos hechos se confundían bajo un único `listo`, lo que no dejaba constancia de si el pedido ya había llegado al cliente o solo estaba preparado esperando a que el camarero lo recogiera.
- **`listo`**: el camarero responsable del pedido confirmó en la app que lo entregó en la mesa (`CAM-07`). Es el estado final de la línea.

Igual que el resto de transiciones de estado del sistema (ver "Estrategia de coste cero"), esta secuencia se valida **solo en el cliente y en las Firestore Security Rules** (`firebase/firestore.rules`, dos reglas de `update` distintas sobre `pedidos/{pedidoId}/lineas/{lineaId}`, una por rol): cada paso exige que el `estado` actual del documento sea exactamente el anterior de la cadena, y que quien escribe sea, según el paso, el cocinero asignado al pedido (`cocineroId`) o su camarero responsable (`camareroId`) — no se puede saltar de `en_plancha` a `listo` directamente, ni retroceder, ni que un rol haga el paso del otro.

**Nota de vocabulario**: el overview de pedido que ve el camarero (CAM-04) no muestra estos cuatro nombres literales como estado agregado del pedido — usa un vocabulario propio, derivado, pensado para lo que a él le importa: *Esperando* (`cocineroId` todavía `null`, nadie en cocina lo ha tomado), *Cocinando* (tomado, pero ninguna línea ha llegado aún a `pendiente_entrega`), *Pendiente entrega en mesa* (alguna línea ya en `pendiente_entrega`) y *Entregado* (todas las líneas en `listo`). Es una vista calculada, no un campo persistido; cada línea, por separado, sigue mostrando su propio `estado` con las cuatro etiquetas de arriba.

## Decisiones abiertas para siguientes pasos

_(ninguna pendiente ahora mismo — ver "Próximos pasos" para lo que sigue)_

### Resueltas

- **Stack tecnológico**: ver [Interfaces](#interfaces) (Angular + SwiftUI + Jetpack Compose + Firebase Spark).
- **Anti-inanición**: tiempo máximo de espera por pedido, configurable en el CMS.
- **Wireframes de baja fidelidad**: publicados, incluyendo Cliente/Mesa/generar cuenta y overflow.
- **Algoritmo de sugerencia de cocción**: detallado en [ALGORITHM.md](./ALGORITHM.md).
- **Modelo de datos**: detallado en [DATA_MODEL.md](./DATA_MODEL.md) (colecciones, denormalización, transacciones clave sin backend).
- **Retención del histórico**: las cuentas generadas se conservan de forma permanente en `cuentas/` (snapshot de precios incluido) — ver `DATA_MODEL.md`.
- **Firestore Security Rules**: escritas en [`firebase/firestore.rules`](./firebase/firestore.rules) (roles, exclusividad de asignación, transiciones de estado válidas, límites de confianza documentados al no haber backend).
- **Máquina de estados de una línea de pedido**: cuatro estados con confirmación explícita de entrega en mesa — ver [más arriba](#máquina-de-estados-de-una-línea-de-pedido).
- **Estructura del repositorio**: monorepo ya montado (`apps/web`, `apps/ios`, `apps/android`, `firebase/`, `algorithm-spec/`) — ver más abajo.
- **Casos de prueba del algoritmo**: 4 casos "golden" en [`algorithm-spec/`](./algorithm-spec/) (adelantamiento básico, overflow automático, overflow manual, división de pedidos grandes).
- **Historias de usuario**: escritas en [`USER_STORIES.md`](./USER_STORIES.md), por rol, con criterios de aceptación trazables a `DOMAIN.md`/`ALGORITHM.md`/`DATA_MODEL.md`/`firebase/firestore.rules`.
- **Priorización**: orden de construcción P0→P3 en [`USER_STORIES.md`](./USER_STORIES.md#priorización) — P0 es el ciclo operativo mínimo, P1 es la sugerencia activa (el diferenciador del producto).
- **Multi-empresa**: `empresas/{codigo}` como entidad por encima de todo, con rol `superadmin` sobre el `administrador` (ahora acotado a una empresa) — ver `DOMAIN.md`/`DATA_MODEL.md`/`USER_STORIES.md` (`SA-*`).

## Próximos pasos sugeridos

1. Inicializar los proyectos dentro del monorepo (`ng new` en `apps/web`, proyecto Xcode en `apps/ios`, proyecto Gradle en `apps/android`) y el proyecto Firebase en plan Spark (`firebase init` dentro de `firebase/`), y empezar a construir P0.
