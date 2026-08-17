# apps/web

Web app en Angular — rol camarero, cocinero y administrador (CMS), misma funcionalidad que las apps móviles. Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) y [`../../PROGRESS.md`](../../PROGRESS.md) para el estado actual.

Generada con Angular CLI 22.1.4 (standalone, zone.js, Vitest, SCSS, sin SSR).

## Desarrollo

```bash
npm start        # ng serve — http://localhost:4200
npm run build     # ng build — genera dist/
npm test          # ng test — Vitest
```

## Configuración de Firebase

El SDK de Firebase para esta app usa la config en [`firebase-config.js`](./firebase-config.js) (descargada del proyecto real `mi-plancha`, no es secreta — ver `../../firebase/README.md`). Pendiente de integrarla en `src/environments/` cuando se instale `@angular/fire`.
