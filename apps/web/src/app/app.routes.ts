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
    path: 'camarero/clientes/:clienteId/pedidos/nuevo',
    canActivate: [authGuard, rolGuard(['camarero'])],
    loadComponent: () => import('./features/camarero/pedidos/crear/crear').then((m) => m.Crear),
  },
  {
    path: 'camarero/clientes/:clienteId',
    canActivate: [authGuard, rolGuard(['camarero'])],
    loadComponent: () => import('./features/camarero/pedidos/cliente/cliente').then((m) => m.ClientePedidos),
  },
  {
    path: 'camarero/pedidos/:pedidoId',
    canActivate: [authGuard, rolGuard(['camarero'])],
    loadComponent: () => import('./features/camarero/pedidos/detalle/detalle').then((m) => m.Detalle),
  },
  {
    path: 'camarero/clientes/:clienteId/cuenta',
    canActivate: [authGuard, rolGuard(['camarero'])],
    loadComponent: () => import('./features/camarero/cuentas/generar/generar').then((m) => m.Generar),
  },
  {
    path: 'cocinero',
    canActivate: [authGuard, rolGuard(['cocinero'])],
    loadComponent: () => import('./features/cocinero/shell/shell').then((m) => m.CocineroShell),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/cocinero/pendientes/pendientes').then((m) => m.Pendientes) },
      { path: 'plancha', loadComponent: () => import('./features/cocinero/plancha/plancha').then((m) => m.Plancha) },
    ],
  },
  {
    path: 'cocinero/pedidos/:pedidoId',
    canActivate: [authGuard, rolGuard(['cocinero'])],
    loadComponent: () => import('./features/cocinero/pedido/pedido').then((m) => m.Pedido),
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
        path: 'division',
        loadComponent: () => import('./features/admin/division/division').then((m) => m.Division),
      },
      {
        path: 'anti-inanicion',
        loadComponent: () => import('./features/admin/anti-inanicion/anti-inanicion').then((m) => m.AntiInanicion),
      },
      {
        path: 'overflow',
        loadComponent: () => import('./features/admin/overflow/overflow').then((m) => m.Overflow),
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
