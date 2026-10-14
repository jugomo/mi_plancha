// Plugins are declared once here (centralized versions) and applied without
// a version in app/build.gradle.kts — same approach as the rest of the repo
// to keep a single source of truth (see ../../ARCHITECTURE.md).
plugins {
    id("com.android.application") version "9.3.3" apply false
    id("org.jetbrains.kotlin.android") version "2.4.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.0" apply false
    id("com.google.gms.google-services") version "4.4.3" apply false
}
