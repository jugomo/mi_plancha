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
- `CuentaView` — bill view for a table. Calls `fetchBillLines` on appear; "Cobrar y cerrar" closes the table.
- `TablesService` — `@Observable @MainActor`. Listens to `mesas` + collectionGroup `lineas` in real time. Computes `tableOrderInfo` (worst `LineStatus` per table) for card display.
- `LinesService` — `@Observable @MainActor`. Listens to a single table's lines + table document. Creates orders, marks lines delivered, fetches bill lines scoped to the current session via `pedidoCreadoEn >= abiertoEn`. Stores `tableOpenedAt: Date?` read from the `clientes/{clienteId}` document.

### Cook/
- `CookView` — `TabView` with two tabs: **Pedidos** and **Plancha**.
  - *Pedidos*: shows a suggestion card at the top (recalculated every 30 s via `TimelineView`), then lines grouped by status ("En curso" / "Pendientes") with per-order advance buttons.
  - *Plancha*: capacity bar with overflow toggle, lines currently on the grill with cook timer and per-order "Retirar" button.
- `CookLinesService` — `@Observable @MainActor`. Listens to all company lines with status `pending` or `cooking`. Enforces `efectiveCapacity` when advancing a line to `cooking`. Reads algorithm config from `config/plancha`: `grillCapacity`, `maxWaitSeconds`, `umbralDivision`, `tamañoSubgrupo`. Reads overflow config from `config/overflow` and runtime state from `plancha/estado`. Exposes `toggleOverflow(uid:)`.
- `CookSuggestion.swift` — pure, framework-free module implementing the greedy cooking-suggestion algorithm from [`ALGORITHM.md`](../../ALGORITHM.md). Contains:
  - `SuggestionLine`, `SuggestionAlert`, `SuggestionResult` value types.
  - `computeSuggestion(pendingLines:cookingLines:products:grillCapacity:overflowPercent:overflowManualActive:maxWaitSeconds:umbralDivision:tamañoSubgrupo:now:) → SuggestionResult` — steps 1–4 of the algorithm (urgency, candidate queue, greedy selection with overflow, product-type bonus pass).

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

## Suggestion Algorithm: Client-Side Execution

`computeSuggestion` runs entirely on the client with no backend. It is a pure function called from `CookView` inside a `TimelineView(.periodic(from: .now, by: 30))` so that urgency thresholds are re-evaluated every 30 seconds even without a Firestore event. It also re-runs on any `service.lines` change because `CookView.body` observes the `@Observable` service.

The algorithm receives `grillCapacity` (base, for computing `usingOverflow`) separately from the `capacity` displayed in the suggestion card (which uses `efectiveCapacity` when overflow is active), so the overflow flame indicator reflects exceeding the base capacity regardless of manual overflow state.
