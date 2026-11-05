import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth';
export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/pages/auth-page/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'workplace/statistic',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/worklog/pages/statistic-page/statistic-page').then((m) => m.StatisticPage),
  },
  {
    path: 'workplace/worklog',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/worklog/pages/worklog-page/worklog-page').then((m) => m.WorklogPage),
  },
  {
    path: 'personal',
    loadComponent: () =>
      import('./features/personal/pages/personal-page/personal-page').then((m) => m.PersonalPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'workplace/worklog' },
  { path: '**', redirectTo: 'workplace/worklog' },
];
