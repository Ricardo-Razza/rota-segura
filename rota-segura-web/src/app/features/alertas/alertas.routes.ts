import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Alertas · Rota Segura',
    loadComponent: () => import('./alertas').then((m) => m.Alertas),
  },
] satisfies Routes;
