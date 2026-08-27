# apps/ios

App nativa iOS en SwiftUI — rol camarero, cocinero y administrador (CMS), misma funcionalidad que la web y Android. Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Estado

Login funcional contra Firebase Auth (con restauración de sesión) y enrutado por rol leyendo
el documento del usuario en Firestore. Implementado hasta ahora:

- **Login** (`LoginView`, `AuthService`, `UsernameEmail`): inicio de sesión con código de
  empresa + usuario + contraseña, que se traduce a un email sintético para Firebase Auth.
  Al arrancar, si hay sesión activa se restaura y se vuelve a resolver el usuario en Firestore.
- **Modelo de datos** (`User.swift`): `Usuario` (con `rol`: camarero/cocinero/administrador/
  superadmin), `Table` y `OrderLine`.
- **Enrutado por rol** (`ContentView`, `RoleContainerView`): tras el login se muestra la vista
  según `rol`. Camarero y cocinero/administrador/superadmin comparten un contenedor con
  toolbar (nombre + botón "Salir"); solo el flujo de camarero tiene vistas propias por ahora,
  el resto son placeholders de texto.
- **Camarero** (`WaiterView`, `TableCardView`, `TablesService`): grid de mesas de la empresa
  con listener en tiempo real sobre `empresas/{companyId}/mesas`.
- **Detalle de mesa** (`TableDetailView`, `LinesService`): líneas de pedido de una mesa vía
  `collectionGroup("lineas")`, filtradas por `mesaNumero` + `empresaId` y que excluyen las ya
  listas; swipe para marcar una línea como entregada.
- Cocinero, administrador (CMS) y superadmin: sin implementar, muestran solo un texto de
  placeholder.

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
