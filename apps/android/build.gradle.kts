// Declara los plugins una vez aquí (versión centralizada) y se aplican sin
// versión en app/build.gradle.kts — mismo criterio que el resto del repo de
// mantener una única fuente de verdad (ver ../../ARCHITECTURE.md).
plugins {
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "2.4.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.0" apply false
}
