import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Análises · Rota Segura',
    loadComponent: () => import('./analises').then((m) => m.Analises),
  },
] satisfies Routes;
