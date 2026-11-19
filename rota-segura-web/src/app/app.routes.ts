import { Routes } from '@angular/router';
import { autenticadoGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · Rota Segura',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    // Vitrine dos componentes: não usa dados nem API, por isso fica fora da área autenticada.
    path: 'design-system',
    title: 'Design system · Rota Segura',
    loadComponent: () =>
      import('./features/design-system/design-system').then((m) => m.DesignSystem),
  },
  {
    // Modo TV: fora do shell (sem menu), mas autenticado.
    path: 'operacao',
    title: 'Modo operação · Rota Segura',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./features/operacao/operacao').then((m) => m.Operacao),
  },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes') },
      { path: 'escolas', loadChildren: () => import('./features/escolas/escolas.routes') },
      { path: 'presenca', loadChildren: () => import('./features/presenca/presenca.routes') },
      { path: 'jornada', loadChildren: () => import('./features/jornada/jornada.routes') },
      { path: 'veiculos', loadChildren: () => import('./features/veiculos/veiculos.routes') },
      { path: 'alertas', loadChildren: () => import('./features/alertas/alertas.routes') },
      { path: 'alunos', loadChildren: () => import('./features/alunos/alunos.routes') },
      { path: 'analises', loadChildren: () => import('./features/analises/analises.routes') },
      { path: 'relatorios', loadChildren: () => import('./features/relatorios/relatorios.routes') },
    ],
  },
  { path: '**', redirectTo: '' },
];
