import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Veículos · Rota Segura',
    loadComponent: () => import('./veiculos').then((m) => m.Veiculos),
  },
] satisfies Routes;
