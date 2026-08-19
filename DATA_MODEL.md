# Modelo de datos (Firestore) — mi_plancha

Para el dominio, ver [DOMAIN.md](./DOMAIN.md); para por qué Firestore y sin Cloud Functions, ver [ARCHITECTURE.md](./ARCHITECTURE.md); para cómo se consume este modelo desde el algoritmo de sugerencia, ver [ALGORITHM.md](./ALGORITHM.md).

## Convenciones

- Todos los timestamps se escriben con `serverTimestamp()` (hora del servidor de Firestore, no del dispositivo — importante para que la prioridad FIFO y la anti-inanición sean consistentes entre clientes).
- Se **denormalizan** algunos campos (duplicar un dato en varios documentos) en varios puntos de este modelo. Es deliberado: al no haber backend (Cloud Functions, ver `ARCHITECTURE.md`) no hay quien mantenga vistas materializadas o haga *joins* en servidor — cada cliente lee directamente de Firestore, así que evitar lecturas encadenadas (leer un pedido y luego, por cada línea, leer aparte el pedido padre) importa tanto para rendimiento como para no chocar contra las cuotas gratuitas del plan Spark.
- Toda escritura que deba mantener consistentes **dos o más documentos a la vez** (ver "Transacciones clave" más abajo) se hace con una `transaction` de Firestore, nunca con escrituras sueltas — es la única red de seguridad que tenemos sin backend.

## Colecciones

### `empresas/{codigo}` — entidad por encima de todo (multi-empresa)

Cada `empresas/{codigo}` es un restaurante independiente. `codigo` es el id del
documento y también el valor que se guarda en `usuarios/{uid}.empresaId` —
un único identificador canónico, sin join (ver "Generación del código de
empresa" más abajo). Todas las colecciones operativas de esta sección (desde
`mesas/` hasta `plancha/estado`) viven **anidadas** bajo `empresas/{codigo}/...`
— el aislamiento entre empresas se deriva de la ruta, no de un campo, salvo la
única excepción de `lineas` (ver su apartado).

- `codigo: string`
- `nombre: string`
- `activa: boolean` — el "borrado" de una empresa (CMS del superadmin) es
  desactivarla, nunca un borrado real: bloquea el login de todo su personal
  (`Sesion` escucha este campo en tiempo real, igual que ya hace con
  `usuarios/{uid}.activo`) y la oculta de los listados activos, pero conserva
  todos sus datos — mismo criterio que `cuentas/`, que tampoco se borra nunca.
- `creadaEn: timestamp`

#### Generación del código de empresa

Formato: 1 letra mayúscula + 3 dígitos (ej. `A001`; 26.000 combinaciones
posibles). Se genera al azar y se reintenta contra un `getDoc` hasta encontrar
uno libre (`EmpresasService.generarCodigoUnico()`) — a esta escala, más simple
que un contador secuencial y sin condición de carrera entre dos altas de
empresa simultáneas, sin necesitar una transacción.

### `empresas/{codigo}/config/*` — documentos únicos de configuración (CMS)

| Documento | Campos |
|---|---|
| `config/plancha` | `capacidadTotal: number` |
| `config/division` | `umbral: number`, `tamanoSubgrupo: number` |
| `config/antiInanicion` | `tiempoMaximoEsperaMin: number` |
| `config/overflow` | `porcentaje: number` |
| `config/mesas` | `numeroDeMesas: number` — al cambiarlo, el administrador crea/elimina documentos en `mesas/` para que coincidan |

### `usuarios/{uid}` — plana, NO anidada bajo `empresas/`

Se queda en la raíz porque el `uid` de Firebase Auth ya es único globalmente,
y el login necesita resolverla desde una única ruta conocida sin depender
todavía del rol/empresa (que es justo lo que este documento resuelve).

- `nombre: string`
- `rol: "camarero" | "cocinero" | "administrador" | "superadmin"`
- `empresaId: string | null` — código de la empresa (ver arriba); `null`
  **solo** para `superadmin`, que no pertenece a ninguna.
- `email: string` — email real para `administrador`/`superadmin`; para
  `camarero`/`cocinero` es un email **sintético** derivado de empresa+usuario
  (ver "Login de camarero/cocinero" más abajo), denormalizado desde Firebase
  Auth en el momento de crear el usuario (ver ADM-07/SA-03); no es la fuente
  de verdad (esa es Auth), solo evita tener que consultar Auth Admin desde el
  cliente para mostrarlo en el CMS.
- `username: string | null` — solo `camarero`/`cocinero`; es lo que teclean
  para entrar (junto al código de empresa), no un email.
- `activo: boolean`
- `creadoEn: timestamp`

Es la fuente de verdad del rol (en vez de custom claims, ver `ARCHITECTURE.md`) — las Security Rules lo consultan con `get()`.

#### Login de camarero/cocinero: email sintético

Camarero/cocinero no tienen email real: inician sesión con **código de
empresa + usuario + contraseña**, pero por debajo Firebase Auth solo sabe
autenticar con email+password (sin backend, no hay otra forma — ver
`ARCHITECTURE.md`). El cliente deriva un email determinista
`{username}@{codigoEmpresa}.miplancha.local` (todo en minúsculas,
`core/username-email.ts`) tanto al dar de alta la cuenta como al iniciar
sesión — sin necesitar ninguna consulta previa a Firestore para resolverlo.
Esto además garantiza que un `username` sea único **dentro de su empresa**
(Firebase Auth ya rechaza un email duplicado) aunque se repita en otra
empresa, sin necesidad de validarlo aparte.

### `empresas/{codigo}/mesas/{numero}`

`numero` como id del documento (string, ej. `"4"`).

- `numero: number`
- `estado: "libre" | "ocupada"`
- `clienteId: string | null` — denormalizado desde `clientes/`, para poder listar todas las mesas con quién las ocupa sin una consulta adicional por mesa.

### `empresas/{codigo}/clientes/{clienteId}`

Existe desde que el camarero abre la mesa hasta que genera la cuenta (`DOMAIN.md`).

- `mesaId: string` (= `numero` de la mesa)
- `nombre: string`
- `camareroId: uid`
- `abiertoEn: timestamp`

### `empresas/{codigo}/pedidos/{pedidoId}`

- `clienteId: string`
- `mesaNumero: number` — denormalizado (sobrevive aunque el cliente se borre al generar la cuenta, de forma que el pedido conserva su contexto como historial).
- `clienteNombre: string` — denormalizado, mismo motivo.
- `camareroId: uid`
- `cocineroId: uid | null` — `null` hasta que un cocinero lo toma; a partir de ahí, exclusivo (ver Security Rules, próximo paso).
- `creadoEn: timestamp`
- `subgrupoActual: number` — solo relevante si el pedido supera `config/division.umbral`.
- `cuentaId: string | null` — se rellena al generar la cuenta del cliente (ver `cuentas/` más abajo); mientras es `null`, el pedido sigue "activo".

No se guarda un campo `estado` agregado en el pedido: se deriva siempre de sus líneas (ver más abajo), para evitar que un campo calculado se desincronice sin backend que lo repare.

#### Subcolección `empresas/{codigo}/pedidos/{pedidoId}/lineas/{lineaId}`

- `productoId: string`
- `cantidad: number`
- `estado: "pendiente" | "en_plancha" | "pendiente_entrega" | "listo"` — ver la máquina de estados completa en [ARCHITECTURE.md](./ARCHITECTURE.md#máquina-de-estados-de-una-línea-de-pedido)
- `subgrupo: number`
- `colocadoEn: timestamp | null`
- `retiradoEn: timestamp | null`
- `listoEn: timestamp | null`
- `usandoOverflow: boolean`
- Denormalizado desde el pedido padre, **solo para poder hacer *collection group queries* eficientes** (ver abajo): `pedidoCreadoEn: timestamp`, `cocineroId: uid | null`, `mesaNumero: number`, **`empresaId: string`**.

Las líneas van en subcolección (no como array dentro del pedido) para poder actualizar una línea suelta sin reescribir el pedido entero, y para que las Security Rules puedan autorizar por línea (ej. "solo el cocinero asignado puede cambiar el estado de esta línea").

`empresaId` es un caso aparte dentro de la denormalización: a diferencia de mesas/clientes/pedidos/productos/cuentas/config, que derivan su empresa directamente de la ruta (`empresas/{codigo}/...`), las *collection group queries* sobre `lineas` (ver más abajo) recorren la colección **`lineas` entera, cruzando todas las empresas**, sin importar el anidado — solo se pueden acotar por un campo real, nunca por un segmento de ruta. Por eso cada línea lo lleva escrito, y tanto las consultas como la Security Rule de `lineas` lo usan para no filtrar datos de otra empresa.

### `empresas/{codigo}/productos/{productoId}`

- `nombre: string`
- `capacidadUnidad: number`
- `tiempoCoccionSeg: number`
- `stock: number`
- `precio: number`

### `empresas/{codigo}/cuentas/{cuentaId}`

Registro histórico permanente, creado al generar la cuenta (`DOMAIN.md`) — es lo único del flujo que se conserva a propósito para consulta futura; los `pedidos` no son la fuente de verdad del histórico (ver más abajo).

- `mesaNumero: number`, `clienteNombre: string` — denormalizados, ya que `clientes/{clienteId}` se borra al generar la cuenta.
- `camareroId: uid` — quien la generó.
- `pedidoIds: array<string>` — referencia a los pedidos incluidos.
- `lineas: array<{ pedidoId, productoNombre, cantidad, precioUnidad, subtotal }>` — **snapshot** de nombres y precios en el momento de generar la cuenta, no una referencia viva a `productos/`. Es importante que sea snapshot: si el administrador cambia un precio en el CMS más tarde, las cuentas ya generadas no deben cambiar de valor retroactivamente.
- `total: number`
- `generadaEn: timestamp`

Los `pedidos` incluidos se marcan con `cuentaId: string` (añadido al esquema de `pedidos/{pedidoId}` de arriba) para saber que ya fueron facturados.

### `empresas/{codigo}/plancha/estado`

Documento único de **estado operativo** (no configuración — lo toca cualquier cocinero en tiempo real, a diferencia de `config/plancha` que solo toca el administrador):

- `overflowManualActivo: boolean`
- `activadoPor: uid | null`
- `activadoEn: timestamp | null`

## Cómo se calcula la capacidad usada en tiempo real

No se guarda como campo persistido (se desincronizaría fácilmente sin backend). Se obtiene con una **collection group query** sobre `lineas` filtrando `empresaId == <la mía>` y `estado == "en_plancha"`, escuchada en tiempo real (`onSnapshot`) por cada cliente; la capacidad usada es la suma de `cantidad × capacidadUnidad(producto)` de esas líneas. El mismo mecanismo (collection group sobre `lineas`, filtrando `empresaId` y `estado == "pendiente"`) alimenta la cola de candidatos del algoritmo de sugerencia (`ALGORITHM.md`), ya con `pedidoCreadoEn`, `cocineroId` y `mesaNumero` disponibles sin lecturas adicionales gracias a la denormalización.

**Requiere un índice de *collection group*** sobre `lineas` — `empresaId + estado + pedidoCreadoEn` (campo líder `empresaId` porque las 4 consultas que lo usan siempre filtran primero por empresa, ver más arriba).

## Transacciones clave (invariantes multi-documento)

Sin backend, estas operaciones son las que más importa que sean atómicas — todas se implementan como `runTransaction` en el cliente. Todas las rutas de abajo son relativas a `empresas/{codigo}/...` (se omite el prefijo por brevedad):

1. **Abrir mesa**: crea `clientes/{nuevoId}` y actualiza `mesas/{numero}` a `estado: "ocupada"` + `clienteId` en la misma transacción. Falla si la mesa ya estaba `"ocupada"`.
2. **Tomar pedido**: actualiza `pedidos/{id}.cocineroId` de `null` al uid del cocinero. Falla (con reintento/lectura fresca) si ya no es `null` — así se garantiza la exclusividad aunque dos cocineros lo intenten a la vez.
3. **Colocar producto en la plancha**: actualiza la línea a `estado: "en_plancha"` + `colocadoEn` y descuenta `productos/{id}.stock` en la misma transacción. Falla si el stock ya no alcanza.
4. **Generar cuenta**: lee todas las `lineas` de todos los `pedidos` del cliente para componer el listado con snapshot de precios y el total, y en una transacción: crea `cuentas/{nuevoId}` con ese snapshot, marca cada `pedidos/{id}.cuentaId` con el id de la cuenta, borra `clientes/{clienteId}` y actualiza `mesas/{numero}` a `estado: "libre"`, `clienteId: null`. Los `pedidos` en sí **no se borran automáticamente** (quedan como detalle operativo denormalizado), pero la fuente de verdad del histórico de cara al negocio es `cuentas/` — se conserva de forma permanente, sin fecha de expiración por ahora. Una vez facturado (`cuentaId != null`), el cocinero que lo llevó puede borrarlo manualmente desde su lista de completados, como limpieza opcional — `cuentas/` ya tiene todo lo necesario como historial, así que el pedido operativo deja de hacer falta. Antes de facturar, el borrado está bloqueado por las reglas.
5. **Cerrar mesa sin pedidos**: variante de la anterior para un cliente que abrió mesa pero no llegó a pedir nada — no hay `lineas` que leer ni nada que sumar, así que la transacción se reduce a borrar `clientes/{clienteId}` y liberar `mesas/{numero}`, sin crear ningún documento en `cuentas/` (un histórico con total 0€ no aporta nada).

## Seguridad

Las reglas que aplican este modelo (roles, aislamiento entre empresas, exclusividad de asignación, transiciones de estado válidas) están en [`firebase/firestore.rules`](./firebase/firestore.rules) — es la única capa de validación de servidor que existe, al no haber backend. El aislamiento entre empresas se deriva de la ruta (`empresas/{empresaId}/...`) en casi todas las colecciones; la única excepción es la collection group query sobre `lineas`, que compara el campo `empresaId` denormalizado (ver más arriba) porque no hay forma de acotar por ruta ese tipo de consulta.
