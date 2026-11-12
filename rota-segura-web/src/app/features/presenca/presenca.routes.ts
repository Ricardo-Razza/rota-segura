import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Presença do dia · Rota Segura',
    loadComponent: () => import('./presenca').then((m) => m.Presenca),
  },
] satisfies Routes;
