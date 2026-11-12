import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Alunos · Rota Segura',
    loadComponent: () => import('./alunos').then((m) => m.Alunos),
  },
  {
    // Só o id na URL: o nome do aluno nunca vai para o endereço.
    path: ':id',
    title: 'Perfil do aluno · Rota Segura',
    loadComponent: () => import('./perfil-aluno').then((m) => m.PerfilAluno),
  },
] satisfies Routes;
