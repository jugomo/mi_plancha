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
- **Cuenta y cobro** (`CuentaView`): lista todas las líneas de la sesión actual
  (`fetchBillLines`, filtra por `pedidoCreadoEn >= abiertoEn` para excluir líneas de sesiones
  anteriores en la misma mesa) con precio y calcula el total; "Cobrar y cerrar" cierra la mesa
  (vuelve a `libre`, limpia `clienteId`).
- **Productos** (`ProductUtils.swift`): `fetchProducts` trae el catálogo de
  `empresas/{companyId}/productos` (nombre, precio, stock, capacidad de unidad en plancha y
  tiempo de cocción), usado por camarero y cocinero.
- **Cocinero — tab Pedidos** (`CookView`, `CookLinesService`): lista en tiempo real de todas
  las líneas pendientes o en plancha de la empresa (`collectionGroup("lineas")`). Arriba del
  todo, un **card de sugerencia** (`CookSuggestion.swift`) ejecuta el algoritmo greedy de
  `ALGORITHM.md` y propone qué líneas colocar en la plancha — se recalcula con cada cambio
  de Firestore y cada 30 s (para que los cruces de umbral de urgencia se detecten a tiempo).
  Debajo, líneas agrupadas en "En curso" y "Pendientes" con botones de avance por pedido.
  Muestra alerta "plancha llena" si se supera la capacidad.
- **Cocinero — tab Plancha** (`CookView`): barra de capacidad (usada / total), botón de
  overflow manual, líneas en plancha con temporizador de cocción por producto y botón
  "Retirar de plancha" por pedido.
- **Algoritmo de sugerencia** (`CookSuggestion.swift`): implementación pura en Swift del
  algoritmo greedy de 4 pasos (urgencia → cola de candidatos → selección greedy con
  overflow auto/manual → bonificación por tipo de producto). `SuggestionResult` contiene las
  líneas sugeridas, la capacidad proyectada tras colocarlas y alertas para pedidos forzados
  que no caben ni con overflow.
- Administrador (CMS) y superadmin: sin implementar, muestran solo un texto de placeholder.

## Tecnología

- SwiftUI, deployment target iOS 17
- Bundle id: `com.jugomo.miplancha`
- El proyecto se genera con [XcodeGen](https://github.com/yonaskolb/XcodeGen) a partir de
  `project.yml` (fuente de verdad); `MiPlancha.xcodeproj` queda commiteado para poder abrir
  el proyecto directamente sin tener XcodeGen instalado.
- `MiPlancha/GoogleService-Info.plist` ya está en el target (mismo proyecto Firebase
  `mi-plancha` que la web), con el Firebase SDK (Auth + Firestore) añadido vía SPM.

## Índices de Firestore necesarios

Además de los índices ya necesarios para `TablesService` y `CookLinesService`, `fetchBillLines`
requiere un índice compuesto en el collection group `lineas`:

| Campos | Orden |
|---|---|
| `mesaNumero` | ASC |
| `empresaId` | ASC |
| `pedidoCreadoEn` | ASC |

Firestore logueará un enlace de creación directa la primera vez que la query falle sin él.

## Compilar

```bash
xcodebuild -project MiPlancha.xcodeproj -scheme MiPlancha \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

Si se edita `project.yml`, regenerar el proyecto con `xcodegen generate` (requiere
`brew install xcodegen`).
