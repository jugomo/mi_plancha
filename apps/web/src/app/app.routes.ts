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
    loadComponent: () => import('./features/camarero/home/home').then((m) => m.CamareroHome),
  },
  {
    path: 'cocinero',
    canActivate: [authGuard, rolGuard(['cocinero'])],
    loadComponent: () => import('./features/cocinero/home/home').then((m) => m.CocineroHome),
  },
  {
    path: 'admin',
    canActivate: [authGuard, rolGuard(['administrador'])],
    loadComponent: () => import('./features/admin/home/home').then((m) => m.AdminHome),
  },
  { path: '**', redirectTo: 'login' },
];
