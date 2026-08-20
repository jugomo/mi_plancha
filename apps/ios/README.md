# apps/ios

App nativa iOS en SwiftUI — rol camarero, cocinero y administrador (CMS), misma funcionalidad que la web y Android. Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Estado

Proyecto Xcode inicializado con un placeholder genérico ("In progress — mi_plancha") al
abrir la app. Todavía sin lógica de negocio ni SDK de Firebase cableado — eso llega en una
fase posterior.

- SwiftUI, deployment target iOS 17
- Bundle id: `com.jugomo.miplancha`
- El proyecto se genera con [XcodeGen](https://github.com/yonaskolb/XcodeGen) a partir de
  `project.yml` (fuente de verdad); `MiPlancha.xcodeproj` queda commiteado para poder abrir
  el proyecto directamente sin tener XcodeGen instalado.
- `MiPlancha/GoogleService-Info.plist` ya está en el target (mismo proyecto Firebase
  `mi-plancha` que la web), pero el SDK de Firebase aún no está añadido como dependencia.

## Compilar

```bash
xcodebuild -project MiPlancha.xcodeproj -scheme MiPlancha \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

Si se edita `project.yml`, regenerar el proyecto con `xcodegen generate` (requiere
`brew install xcodegen`).
