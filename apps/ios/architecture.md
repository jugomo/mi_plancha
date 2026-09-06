# Architecture

## Entry Point

`MiPlanchaApp` configures Firebase and creates a single `AuthService` instance passed down to `ContentView`.

## Auth Flow

```
LoginView → AuthService.initSession(companyCode, username, password)
         → constructs synthetic email: username@companyCode.miplancha.local
         → Firebase Auth signIn
         → fetches Usuario from Firestore /usuarios/{uid}
         → ContentView reacts to auth.usuario change
```

On relaunch, `AuthService.init()` restores the session from `Auth.auth().currentUser` and re-fetches the `Usuario` document.

## Role Dispatch

`ContentView` switches on `usuario.rol` and renders the matching root view wrapped in `RoleContainerView`:

| Rol | Root View |
|---|---|
| `camarero` | `WaiterView(companyId:)` |
| `cocinero` | `CookView(companyId:userId:)` |
| `administrador` | **pending** |
| `superadmin` | **pending** |

`RoleContainerView` provides a `NavigationStack` with the user's name and a logout button in the toolbar. It is generic (`Content: View`) so it works for any role.

## Feature Modules

### Auth/
- `AuthService` — `@Observable @MainActor` class. Manages Firebase Auth session and `Usuario` fetch.
- `LoginView` — form with companyCode / username / password. Stateless: calls `onLogin` closure.
- `User.swift` — all shared domain types (`Usuario`, `Rol`, `Table`, `TableStatus`, `OrderLine`, `LineStatus`, `Order`).
- `UsernameEmail` — utility enum that builds the synthetic Firebase email from company code + username.

### Waiter/
- `WaiterView` — overview of all tables as cards. Navigates to `TableDetailView`.
- `TableCardView` — single table card component.
- `TableDetailView` — detail for one table: lists active orders grouped, can add new order, mark delivered, request bill.
- `AddLineView` — form to add products to a new order.
- `CuentaView` — bill view for a table.
- `TablesService` — `@Observable @MainActor`. Listens to `mesas` + collectionGroup `lineas` in real time. Computes `tableOrderInfo` (worst `LineStatus` per table) for card display.
- `LinesService` — `@Observable @MainActor`. Listens to a single table's lines + table document. Creates orders (`pedidos`/`lineas`), marks lines delivered, fetches bill lines.

### Cook/
- `CookView` — `TabView` with two tabs: Pedidos and Plancha. Receives `companyId` and `userId`. Pedidos muestra líneas agrupadas por estado con swipe para avanzar. Plancha muestra barra de capacidad, botón de overflow manual, y líneas en cocción con temporizador.
- `CookLinesService` — `@Observable @MainActor`. Listens to all company lines with status `pending` or `cooking`. Enforces `efectiveCapacity` (which accounts for overflow) when advancing a line to `cooking`. Advances lines: `pending → cooking → pendingDelivery`. Exposes `toggleOverflow(uid:)` to activate/deactivate manual overflow, which writes to `/plancha/estado`.

### Shared/
- `RoleContainerView` — generic `NavigationStack` wrapper with toolbar (name + logout).
- `ProductUtils` — free function `fetchProducts(companyId:)` returning `[String: ProductInfo]`.

## Service Pattern

All services follow the same pattern:
1. `@Observable @MainActor final class`
2. `startListening(companyId:)` — attaches Firestore `addSnapshotListener`
3. `stopListening()` — removes listener and nils the `ListenerRegistration`
4. Snapshot callbacks dispatch back to `@MainActor` via `Task { @MainActor in ... }`
5. Write operations are `async throws` methods using `await ref.updateData(...)`

No Combine. State observation uses the Swift `Observation` framework (`@Observable`).
