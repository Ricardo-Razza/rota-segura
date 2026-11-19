import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Escolas · Rota Segura',
    loadComponent: () => import('./escolas').then((m) => m.Escolas),
  },
] satisfies Routes;
