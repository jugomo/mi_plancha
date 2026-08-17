# Modelo de datos (Firestore) — mi_plancha

Para el dominio, ver [DOMAIN.md](./DOMAIN.md); para por qué Firestore y sin Cloud Functions, ver [ARCHITECTURE.md](./ARCHITECTURE.md); para cómo se consume este modelo desde el algoritmo de sugerencia, ver [ALGORITHM.md](./ALGORITHM.md).

## Convenciones

- Todos los timestamps se escriben con `serverTimestamp()` (hora del servidor de Firestore, no del dispositivo — importante para que la prioridad FIFO y la anti-inanición sean consistentes entre clientes).
- Se **denormalizan** algunos campos (duplicar un dato en varios documentos) en varios puntos de este modelo. Es deliberado: al no haber backend (Cloud Functions, ver `ARCHITECTURE.md`) no hay quien mantenga vistas materializadas o haga *joins* en servidor — cada cliente lee directamente de Firestore, así que evitar lecturas encadenadas (leer un pedido y luego, por cada línea, leer aparte el pedido padre) importa tanto para rendimiento como para no chocar contra las cuotas gratuitas del plan Spark.
- Toda escritura que deba mantener consistentes **dos o más documentos a la vez** (ver "Transacciones clave" más abajo) se hace con una `transaction` de Firestore, nunca con escrituras sueltas — es la única red de seguridad que tenemos sin backend.

## Colecciones

### `config/*` — documentos únicos de configuración (CMS)

| Documento | Campos |
|---|---|
| `config/plancha` | `capacidadTotal: number` |
| `config/division` | `umbral: number`, `tamanoSubgrupo: number` |
| `config/antiInanicion` | `tiempoMaximoEsperaMin: number` |
| `config/overflow` | `porcentaje: number` |
| `config/mesas` | `numeroDeMesas: number` — al cambiarlo, el administrador crea/elimina documentos en `mesas/` para que coincidan |

### `usuarios/{uid}`

- `nombre: string`
- `rol: "camarero" | "cocinero" | "administrador"`
- `activo: boolean`
- `creadoEn: timestamp`

Es la fuente de verdad del rol (en vez de custom claims, ver `ARCHITECTURE.md`) — las Security Rules lo consultan con `get()`.

### `mesas/{numero}`

`numero` como id del documento (string, ej. `"4"`).

- `numero: number`
- `estado: "libre" | "ocupada"`
- `clienteId: string | null` — denormalizado desde `clientes/`, para poder listar todas las mesas con quién las ocupa sin una consulta adicional por mesa.

### `clientes/{clienteId}`

Existe desde que el camarero abre la mesa hasta que genera la cuenta (`DOMAIN.md`).

- `mesaId: string` (= `numero` de la mesa)
- `nombre: string`
- `camareroId: uid`
- `abiertoEn: timestamp`

### `pedidos/{pedidoId}`

- `clienteId: string`
- `mesaNumero: number` — denormalizado (sobrevive aunque el cliente se borre al generar la cuenta, de forma que el pedido conserva su contexto como historial).
- `clienteNombre: string` — denormalizado, mismo motivo.
- `camareroId: uid`
- `cocineroId: uid | null` — `null` hasta que un cocinero lo toma; a partir de ahí, exclusivo (ver Security Rules, próximo paso).
- `creadoEn: timestamp`
- `subgrupoActual: number` — solo relevante si el pedido supera `config/division.umbral`.
- `cuentaId: string | null` — se rellena al generar la cuenta del cliente (ver `cuentas/` más abajo); mientras es `null`, el pedido sigue "activo".

No se guarda un campo `estado` agregado en el pedido: se deriva siempre de sus líneas (ver más abajo), para evitar que un campo calculado se desincronice sin backend que lo repare.

#### Subcolección `pedidos/{pedidoId}/lineas/{lineaId}`

- `ingredienteId: string`
- `cantidad: number`
- `estado: "pendiente" | "en_plancha" | "listo"`
- `subgrupo: number`
- `colocadoEn: timestamp | null`
- `listoEn: timestamp | null`
- `usandoOverflow: boolean`
- Denormalizado desde el pedido padre, **solo para poder hacer *collection group queries* eficientes** (ver abajo): `pedidoCreadoEn: timestamp`, `cocineroId: uid | null`, `mesaNumero: number`.

Las líneas van en subcolección (no como array dentro del pedido) para poder actualizar una línea suelta sin reescribir el pedido entero, y para que las Security Rules puedan autorizar por línea (ej. "solo el cocinero asignado puede cambiar el estado de esta línea").

### `ingredientes/{ingredienteId}`

- `nombre: string`
- `capacidadUnidad: number`
- `tiempoCoccionSeg: number`
- `stock: number`
- `precio: number`

### `cuentas/{cuentaId}`

Registro histórico permanente, creado al generar la cuenta (`DOMAIN.md`) — es lo único del flujo que se conserva a propósito para consulta futura; los `pedidos` no son la fuente de verdad del histórico (ver más abajo).

- `mesaNumero: number`, `clienteNombre: string` — denormalizados, ya que `clientes/{clienteId}` se borra al generar la cuenta.
- `camareroId: uid` — quien la generó.
- `pedidoIds: array<string>` — referencia a los pedidos incluidos.
- `lineas: array<{ pedidoId, ingredienteNombre, cantidad, precioUnidad, subtotal }>` — **snapshot** de nombres y precios en el momento de generar la cuenta, no una referencia viva a `ingredientes/`. Es importante que sea snapshot: si el administrador cambia un precio en el CMS más tarde, las cuentas ya generadas no deben cambiar de valor retroactivamente.
- `total: number`
- `generadaEn: timestamp`

Los `pedidos` incluidos se marcan con `cuentaId: string` (añadido al esquema de `pedidos/{pedidoId}` de arriba) para saber que ya fueron facturados.

### `plancha/estado`

Documento único de **estado operativo** (no configuración — lo toca cualquier cocinero en tiempo real, a diferencia de `config/plancha` que solo toca el administrador):

- `overflowManualActivo: boolean`
- `activadoPor: uid | null`
- `activadoEn: timestamp | null`

## Cómo se calcula la capacidad usada en tiempo real

No se guarda como campo persistido (se desincronizaría fácilmente sin backend). Se obtiene con una **collection group query** sobre `lineas` filtrando `estado == "en_plancha"`, escuchada en tiempo real (`onSnapshot`) por cada cliente; la capacidad usada es la suma de `cantidad × capacidadUnidad(ingrediente)` de esas líneas. El mismo mecanismo (collection group sobre `lineas`, filtrando `estado == "pendiente"`) alimenta la cola de candidatos del algoritmo de sugerencia (`ALGORITHM.md`), ya con `pedidoCreadoEn`, `cocineroId` y `mesaNumero` disponibles sin lecturas adicionales gracias a la denormalización.

**Requiere un índice de *collection group*** sobre `lineas` (campo `estado`, y otro compuesto `estado + pedidoCreadoEn` para poder ordenar por antigüedad directamente en la consulta).

## Transacciones clave (invariantes multi-documento)

Sin backend, estas operaciones son las que más importa que sean atómicas — todas se implementan como `runTransaction` en el cliente:

1. **Abrir mesa**: crea `clientes/{nuevoId}` y actualiza `mesas/{numero}` a `estado: "ocupada"` + `clienteId` en la misma transacción. Falla si la mesa ya estaba `"ocupada"`.
2. **Tomar pedido**: actualiza `pedidos/{id}.cocineroId` de `null` al uid del cocinero. Falla (con reintento/lectura fresca) si ya no es `null` — así se garantiza la exclusividad aunque dos cocineros lo intenten a la vez.
3. **Colocar ingrediente en la plancha**: actualiza la línea a `estado: "en_plancha"` + `colocadoEn` y descuenta `ingredientes/{id}.stock` en la misma transacción. Falla si el stock ya no alcanza.
4. **Generar cuenta**: lee todas las `lineas` de todos los `pedidos` del cliente para componer el listado con snapshot de precios y el total, y en una transacción: crea `cuentas/{nuevoId}` con ese snapshot, marca cada `pedidos/{id}.cuentaId` con el id de la cuenta, borra `clientes/{clienteId}` y actualiza `mesas/{numero}` a `estado: "libre"`, `clienteId: null`. Los `pedidos` en sí **no se borran** (quedan como detalle operativo denormalizado), pero la fuente de verdad del histórico de cara al negocio es `cuentas/` — se conserva de forma permanente, sin fecha de expiración por ahora.

## Seguridad

Las reglas que aplican este modelo (roles, exclusividad de asignación, transiciones de estado válidas) están en [`firebase/firestore.rules`](./firebase/firestore.rules) — es la única capa de validación de servidor que existe, al no haber backend.
