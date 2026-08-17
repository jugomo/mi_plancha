import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { Rol, Sesion } from './sesion';

export const HOME_POR_ROL: Record<Rol, string> = {
  camarero: '/camarero',
  cocinero: '/cocinero',
  administrador: '/admin',
};

/** Espera a que la sesión inicial termine de resolverse (undefined -> null | Usuario). */
function sesionResuelta(sesion: Sesion) {
  return toObservable(sesion.usuario).pipe(
    filter((u) => u !== undefined),
    take(1),
  );
}

/** Bloquea rutas que requieren sesión, redirigiendo a /login si no la hay. */
export const authGuard: CanActivateFn = () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  return sesionResuelta(sesion).pipe(map((u) => (u ? true : router.parseUrl('/login'))));
};

/** Además de exigir sesión, exige que el rol esté entre los permitidos para la ruta. */
export function rolGuard(rolesPermitidos: Rol[]): CanActivateFn {
  return () => {
    const sesion = inject(Sesion);
    const router = inject(Router);
    return sesionResuelta(sesion).pipe(
      map((u) => {
        if (!u) return router.parseUrl('/login');
        return rolesPermitidos.includes(u.rol) ? true : router.parseUrl(HOME_POR_ROL[u.rol]);
      }),
    );
  };
}

/** Para /login: si ya hay sesión, redirige directo a la pantalla de su rol. */
export const soloInvitadosGuard: CanActivateFn = () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  return sesionResuelta(sesion).pipe(map((u) => (u ? router.parseUrl(HOME_POR_ROL[u.rol]) : true)));
};
