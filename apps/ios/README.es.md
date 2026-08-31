# apps/ios

🇬🇧 English version: [`README.md`](./README.md)

App nativa iOS en SwiftUI — rol camarero, cocinero y administrador (CMS), misma funcionalidad que la web y Android. Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Estado

Login funcional contra Firebase Auth (con restauración de sesión) y enrutado por rol leyendo
el documento del usuario en Firestore. Implementado hasta ahora:

- **Login** (`LoginView`, `AuthService`, `UsernameEmail`): inicio de sesión con código de
  empresa + usuario + contraseña, que se traduce a un email sintético para Firebase Auth.
  Al arrancar, si hay sesión activa se restaura y se vuelve a resolver el usuario en Firestore.
- **Modelo de datos** (`User.swift`): `Usuario` (con `rol`: camarero/cocinero/administrador/
  superadmin), `Table` (con `TableStatus`: libre/ocupada/cobrar) y `OrderLine` (con
  `LineStatus`: pendiente/en_plancha/pendiente_entrega/listo).
- **Enrutado por rol** (`ContentView`, `RoleContainerView`): tras el login se muestra la vista
  según `rol`. Todos los roles comparten un contenedor con toolbar (nombre + botón "Salir").
  Camarero y cocinero tienen vistas propias; administrador (CMS) y superadmin siguen siendo
  placeholders de texto.
- **Camarero** (`WaiterView`, `TableCardView`, `TablesService`): grid de mesas de la empresa
  con listener en tiempo real sobre `empresas/{companyId}/mesas`. Abrir mesa libre (pide nombre
  de cliente, crea el documento en `clientes`) y cerrar mesa ocupada desde el menú contextual de
  cada tarjeta.
- **Detalle de mesa** (`TableDetailView`, `LinesService`): líneas de pedido de una mesa vía
  `collectionGroup("lineas")`, filtradas por `mesaNumero` + `empresaId` y que excluyen las ya
  listas; swipe para marcar una línea como entregada. Si la mesa está libre se ofrece abrirla
  desde aquí también. Con la mesa ocupada, la toolbar permite añadir una línea de pedido
  (`AddLineView`) y abrir la cuenta (`CuentaView`).
- **Añadir línea de pedido** (`AddLineView`): formulario con picker de productos con stock
  disponible y stepper de cantidad; crea el `pedido` y su línea en Firestore.
- **Cuenta y cobro** (`CuentaView`): lista todas las líneas de la mesa (`fetchBillLines`) con
  precio y calcula el total; "Cobrar y cerrar" cierra la mesa (vuelve a `libre`, limpia
  `clienteId`).
- **Productos** (`ProductUtils.swift`): `fetchProducts` trae el catálogo de
  `empresas/{companyId}/productos` (nombre, precio, stock, capacidad de unidad en la plancha y
  tiempo de cocción), usado por camarero y cocinero.
- **Cocinero** (`CookView`, `CookLinesService`): lista en tiempo real de todas las líneas
  pendientes o en plancha de la empresa (`collectionGroup("lineas")`), con mesa y producto.
  Swipe para avanzar el estado (pendiente → en plancha → pendiente de entrega), respetando la
  `capacidadPlancha` de la empresa frente a la capacidad ya ocupada por lo que está en plancha.
- Administrador (CMS) y superadmin: sin implementar, muestran solo un texto de placeholder.

- SwiftUI, deployment target iOS 17
- Bundle id: `com.jugomo.miplancha`
- El proyecto se genera con [XcodeGen](https://github.com/yonaskolb/XcodeGen) a partir de
  `project.yml` (fuente de verdad); `MiPlancha.xcodeproj` queda commiteado para poder abrir
  el proyecto directamente sin tener XcodeGen instalado.
- `MiPlancha/GoogleService-Info.plist` ya está en el target (mismo proyecto Firebase
  `mi-plancha` que la web), con el Firebase SDK (Auth + Firestore) añadido vía SPM.

## Compilar

```bash
xcodebuild -project MiPlancha.xcodeproj -scheme MiPlancha \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

Si se edita `project.yml`, regenerar el proyecto con `xcodegen generate` (requiere
`brew install xcodegen`).
