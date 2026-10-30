import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: 'workplace/statistic',
    loadComponent: () =>
      import('./features/worklog/pages/statistic-page/statistic-page').then((m) => m.StatisticPage),
  },
  {
    path: 'workplace/worklog',
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
