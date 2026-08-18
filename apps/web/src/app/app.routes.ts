import { Routes } from '@angular/router';

import { authGuard, rolGuard, soloInvitadosGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [soloInvitadosGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'camarero',
    canActivate: [authGuard, rolGuard(['camarero'])],
    loadComponent: () => import('./features/camarero/mesas/mesas').then((m) => m.Mesas),
  },
  {
    path: 'camarero/abrir',
    canActivate: [authGuard, rolGuard(['camarero'])],
    loadComponent: () => import('./features/camarero/abrir-mesa/abrir-mesa').then((m) => m.AbrirMesa),
  },
  {
    path: 'cocinero',
    canActivate: [authGuard, rolGuard(['cocinero'])],
    loadComponent: () => import('./features/cocinero/home/home').then((m) => m.CocineroHome),
  },
  {
    path: 'admin',
    canActivate: [authGuard, rolGuard(['administrador'])],
    loadComponent: () => import('./features/admin/shell/shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ingredientes' },
      {
        path: 'ingredientes',
        loadComponent: () => import('./features/admin/ingredientes/lista/lista').then((m) => m.Lista),
      },
      {
        path: 'ingredientes/nuevo',
        loadComponent: () =>
          import('./features/admin/ingredientes/formulario/formulario').then((m) => m.Formulario),
      },
      {
        path: 'ingredientes/:id',
        loadComponent: () =>
          import('./features/admin/ingredientes/formulario/formulario').then((m) => m.Formulario),
      },
      {
        path: 'plancha',
        loadComponent: () => import('./features/admin/plancha/plancha').then((m) => m.Plancha),
      },
      {
        path: 'mesas',
        loadComponent: () => import('./features/admin/mesas/mesas').then((m) => m.Mesas),
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/admin/usuarios/lista/lista').then((m) => m.Lista),
      },
      {
        path: 'usuarios/invitar',
        loadComponent: () => import('./features/admin/usuarios/invitar/invitar').then((m) => m.Invitar),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
