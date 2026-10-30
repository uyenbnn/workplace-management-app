import { ChangeDetectionStrategy, Component } from '@angular/core';
import { inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { WorkplaceNavigation } from './features/worklog/ui/workplace-navigation/workplace-navigation';
import { AppHeader } from './core/layout/app-header/app-header';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeader, WorkplaceNavigation],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  readonly workplace = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.startsWith('/workplace/')),
    ),
    { initialValue: this.router.url.startsWith('/workplace/') },
  );
}
