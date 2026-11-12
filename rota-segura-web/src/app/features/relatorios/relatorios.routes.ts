import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Relatórios · Rota Segura',
    loadComponent: () => import('./relatorios').then((m) => m.Relatorios),
  },
] satisfies Routes;
