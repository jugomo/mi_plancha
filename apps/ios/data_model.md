# Data Model

## Firestore Collections

### `/usuarios/{uid}`
| Field | Type | Notes |
|---|---|---|
| `nombre` | String | Display name |
| `rol` | String | `camarero` \| `cocinero` \| `administrador` \| `superadmin` |
| `empresaId` | String? | Null for superadmin |

### `/empresas/{empresaId}/mesas/{mesaId}`
| Field | Type | Notes |
|---|---|---|
| `numero` | Int | Table number (also used as document ID as String) |
| `estado` | String | `libre` \| `ocupada` \| `cobrar` |
| `clienteId` | String? | Ref to `/clientes/{clienteId}`, null when libre |

### `/empresas/{empresaId}/clientes/{clienteId}`
| Field | Type | Notes |
|---|---|---|
| `nombre` | String | Client name |
| `camareroId` | String | UID of waiter who opened the table |
| `mesaId` | String | Document ID of the table |
| `abiertoEn` | Timestamp | When the table was opened — used by `fetchBillLines` to scope lines to the current session |

### `/empresas/{empresaId}/productos/{productoId}`
| Field | Type | Notes |
|---|---|---|
| `nombre` | String | |
| `precio` | Double | |
| `stock` | Int | |
| `capacidadUnidad` | Int | Grill capacity units consumed per unit of this product |
| `tiempoCoccionSeg` | Int | Cook time in seconds |

### `/empresas/{empresaId}/pedidos/{pedidoId}`
| Field | Type | Notes |
|---|---|---|
| `mesaNumero` | Int | Denormalized table number |
| `empresaId` | String | Denormalized for collectionGroup queries |
| `camareroId` | String | UID |
| `cocineroId` | String? | UID, null until assigned |
| `cuentaId` | String? | Null until bill generated |
| `creadoEn` | Timestamp | |
| `clienteId` | String? | |
| `clienteNombre` | String? | Denormalized client name |

### `/empresas/{empresaId}/pedidos/{pedidoId}/lineas/{lineaId}`
| Field | Type | Notes |
|---|---|---|
| `productoId` | String | |
| `cantidad` | Int | |
| `estado` | String | See LineStatus below |
| `mesaNumero` | Int | Denormalized for collectionGroup queries |
| `empresaId` | String | Denormalized for collectionGroup queries |
| `pedidoCreadoEn` | Timestamp | Copied from parent order creation time — used to scope bill lines to current session |
| `colocadoEn` | Timestamp? | Set when cook moves to `cooking` |

### `/empresas/{empresaId}/config/plancha`
| Field | Type | Notes |
|---|---|---|
| `capacidadTotal` | Int | Max total grill capacity units |
| `tiempoMaximoEspera` | Int | Max wait seconds before an order becomes forced (anti-starvation) |
| `umbralDivision` | Int | Order line count above which subgroup logic applies (default 8) |
| `tamañoSubgrupo` | Int | Number of lines per subgroup for large orders (default 4) |

### `/empresas/{empresaId}/config/overflow`
| Field | Type | Notes |
|---|---|---|
| `porcentaje` | Int | Extra capacity % allowed (e.g. 10 = +10%). Configured in CMS. |

### `/empresas/{empresaId}/plancha/estado`
Runtime state of the grill, shared across all devices.
| Field | Type | Notes |
|---|---|---|
| `overflowManualActivo` | Bool | Whether manual overflow is currently active |
| `activadoPor` | String | UID of the cook who last toggled it |
| `activadoEn` | Timestamp | When it was last toggled |

---

## Swift Types

### `Usuario`
```swift
uid: String
name: String
rol: Rol
companyId: String?
```

### `Rol` (enum)
`camarero` · `cocinero` · `administrador` · `superadmin`

### `Table`
```swift
id: String         // Firestore document ID
number: Int
status: TableStatus
clientId: String?
```

### `TableStatus` (enum)
| Case | Firestore value |
|---|---|
| `libre` | `"libre"` |
| `ocupada` | `"ocupada"` |
| `cobrar` | `"cobrar"` |

### `OrderLine`
```swift
id: String         // Firestore document ID (linea)
amount: Int
status: LineStatus
productId: String
tableNumber: Int
orderId: String    // parent pedido document ID
createdAt: Date    // from pedidoCreadoEn
cookedAt: Date?    // from colocadoEn, set when cook moves to cooking
```

### `LineStatus` (enum) — lifecycle of a line
```
pending  →  cooking  →  pendingDelivery  →  ready
```

| Case | Firestore value | Actor | Meaning |
|---|---|---|---|
| `pending` | `"pendiente"` | (waiter creates) | Waiting for cook |
| `cooking` | `"en_plancha"` | cook | On the grill |
| `pendingDelivery` | `"pendiente_entrega"` | cook | Ready, waiter to deliver |
| `ready` | `"listo"` | waiter | Delivered to client |

### `Order`
```swift
id: String
lines: [OrderLine]
// computed:
createdAt: Date?       // lines.first?.createdAt
isReadyToDeliver: Bool // all lines == .pendingDelivery
```

### `ProductInfo`
```swift
name: String
price: Double
stock: Int
capacidadUnidad: Int
tiempoCoccionSeg: Int
```

### `TableOrderSummary`
Computed by `TablesService` per table number for the waiter overview card.
```swift
worstStatus: LineStatus   // earliest-in-lifecycle status among active lines
lastUpdate: Date
```

### `SuggestionLine`
A line recommended by `computeSuggestion` to place on the grill.
```swift
id: String         // lineId
orderId: String
tableNumber: Int
productId: String
amount: Int
isForced: Bool     // the parent order exceeded maxWaitSeconds
usingOverflow: Bool // this line pushes usage above grillCapacity base
```

### `SuggestionAlert`
An order that is forced (urgent) but cannot fit even with overflow capacity.
```swift
id: String         // orderId
tableNumber: Int
```

### `SuggestionResult`
Output of `computeSuggestion`.
```swift
lines: [SuggestionLine]
capacityAfter: Int    // total grill capacity used if suggestion is accepted (cooking + suggested)
alerts: [SuggestionAlert]
```

---

## Auth: Synthetic Email

Firebase Auth requires an email. The app builds one from company code + username:

```
{username}@{companyCode}.miplancha.local
```

Example: user `maria` at company `V628` → `maria@v628.miplancha.local`

---

## collectionGroup Queries

| Service | Filter | Purpose |
|---|---|---|
| `TablesService` | `empresaId == X`, `estado != listo` | Compute order status summary per table |
| `CookLinesService` | `empresaId == X`, `estado in [pendiente, en_plancha]` | Cook's pending/active lines across all tables |
| `LinesService.fetchBillLines` | `mesaNumero == N`, `empresaId == X`, `pedidoCreadoEn >= abiertoEn` | Bill lines scoped to the current session only |

`fetchBillLines` requires a composite index on `lineas`: `(mesaNumero ASC, empresaId ASC, pedidoCreadoEn ASC)`. Create it from the link Firestore logs on first query failure.
