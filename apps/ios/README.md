# apps/ios

🇪🇸 Versión en español: [`README.es.md`](./README.es.md)

Native iOS app built with SwiftUI — waiter, cook, and admin (CMS) roles, same functionality as the web and Android apps. See [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Status

Login works against Firebase Auth (with session restoration) and role-based routing driven by
the user document in Firestore. Implemented so far:

- **Login** (`LoginView`, `AuthService`, `UsernameEmail`): sign in with company code + username +
  password, translated into a synthetic email for Firebase Auth. On launch, an active session is
  restored and the user is re-resolved in Firestore.
- **Data model** (`User.swift`): `Usuario` (with `rol`: waiter/cook/admin/superadmin), `Table`
  (with `TableStatus`: free/occupied/to-bill) and `OrderLine` (with `LineStatus`: pending/on the
  grill/pending delivery/delivered).
- **Role-based routing** (`ContentView`, `RoleContainerView`): after login the view shown depends
  on `rol`. All roles share a container with a toolbar (name + "Salir" button). Waiter and cook
  have their own views; admin (CMS) and superadmin are still text placeholders.
- **Waiter** (`WaiterView`, `TableCardView`, `TablesService`): grid of the company's tables with a
  real-time listener on `empresas/{companyId}/mesas`. Open a free table (asks for the client's
  name, creates the document under `clientes`) and close an occupied table from each card's
  context menu.
- **Table detail** (`TableDetailView`, `LinesService`): a table's order lines via
  `collectionGroup("lineas")`, filtered by `mesaNumero` + `empresaId` and excluding lines already
  delivered; swipe to mark a line as delivered. If the table is free, opening it is also offered
  from here. With the table occupied, the toolbar allows adding an order line (`AddLineView`) and
  opening the bill (`CuentaView`).
- **Add order line** (`AddLineView`): a form with a picker of products in stock and a quantity
  stepper; creates the `pedido` and its line in Firestore.
- **Bill and checkout** (`CuentaView`): lists every line for the table (`fetchBillLines`) with
  price and computes the total; "Cobrar y cerrar" closes the table (back to `libre`, clears
  `clienteId`).
- **Products** (`ProductUtils.swift`): `fetchProducts` fetches the catalog from
  `empresas/{companyId}/productos` (name, price, stock, grill-unit capacity and cooking time),
  used by both waiter and cook.
- **Cook** (`CookView`, `CookLinesService`): real-time list of every pending or on-the-grill line
  across the company (`collectionGroup("lineas")`), with table and product. Swipe to advance the
  status (pending → on the grill → pending delivery), respecting the company's `capacidadPlancha`
  against the capacity already in use by what's on the grill.
- Admin (CMS) and superadmin: not implemented yet, show only a placeholder text.

- SwiftUI, deployment target iOS 17
- Bundle id: `com.jugomo.miplancha`
- The project is generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen) from
  `project.yml` (source of truth); `MiPlancha.xcodeproj` stays committed so the project can be
  opened directly without having XcodeGen installed.
- `MiPlancha/GoogleService-Info.plist` is already in the target (same Firebase project
  `mi-plancha` as the web app), with the Firebase SDK (Auth + Firestore) added via SPM.

## Build

```bash
xcodebuild -project MiPlancha.xcodeproj -scheme MiPlancha \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

If `project.yml` is edited, regenerate the project with `xcodegen generate` (requires
`brew install xcodegen`).
