import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Dashboard · Rota Segura',
    loadComponent: () => import('./dashboard').then((m) => m.Dashboard),
  },
] satisfies Routes;
