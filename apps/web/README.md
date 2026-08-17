# apps/web

Web app en Angular — rol camarero, cocinero y administrador (CMS), misma funcionalidad que las apps móviles. Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) y [`../../PROGRESS.md`](../../PROGRESS.md) para el estado actual.

Generada con Angular CLI 22.1.4 (standalone, zone.js, Vitest, SCSS, sin SSR).

## Desarrollo

```bash
npm start        # ng serve — http://localhost:4200
npm run build     # ng build — genera dist/
npm test          # ng test — Vitest
```

## Firebase

Se usa el **SDK modular de `firebase`** directamente (paquete `firebase`), no `@angular/fire` — a fecha de esta app, `@angular/fire` todavía no publica una versión compatible con Angular 22 (su release candidate más reciente solo llega a Angular 21). La config del proyecto `mi-plancha` está en [`src/environments/environment.ts`](./src/environments/environment.ts) — no es secreta (ver `../../firebase/README.md`), la seguridad real vive en `firebase/firestore.rules`.

Firestore y Auth se exponen como `InjectionToken`s en [`src/app/core/firebase.providers.ts`](./src/app/core/firebase.providers.ts) (`FIRESTORE`, `AUTH`), en vez de llamar a los getters globales del SDK desde cada componente/servicio.
