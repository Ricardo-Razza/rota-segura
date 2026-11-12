import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Jornada do aluno · Rota Segura',
    loadComponent: () => import('./jornada').then((m) => m.Jornada),
  },
] satisfies Routes;
