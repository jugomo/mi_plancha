# apps/android

App nativa Android en Kotlin Jetpack Compose — rol camarero, cocinero y administrador (CMS), misma funcionalidad que la web e iOS. Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Estado

Proyecto Gradle inicializado con un placeholder genérico ("In progress — mi_plancha") al
abrir la app. Todavía sin lógica de negocio ni SDK de Firebase cableado — eso llega en una
fase posterior.

- Kotlin + Jetpack Compose (Material 3)
- `applicationId` / `namespace`: `com.jugomo.miplancha`
- `compileSdk` / `targetSdk` 36, `minSdk` 26
- `google-services.json` ya está copiado en `app/` (mismo proyecto Firebase `mi-plancha`
  que la web), pero el plugin de Google Services aún no está aplicado.

## Compilar

Requiere el Android SDK (`ANDROID_HOME`) con `platform android-36` y `build-tools 36.0.0`.

```bash
./gradlew :app:assembleDebug
```

El APK de debug queda en `app/build/outputs/apk/debug/app-debug.apk`.
