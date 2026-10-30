import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-workplace-navigation',
  styleUrl: './workplace-navigation.scss',
  templateUrl: './workplace-navigation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkplaceNavigation {}
