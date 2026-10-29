import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
@Component({
  selector: 'app-month-navigation',
  templateUrl: './month-navigation.html',
  styleUrl: './month-navigation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthNavigation {
  readonly period = input<'month' | 'work week'>('month');
  readonly label = input.required<string>();
  readonly move = output<number>();
  readonly today = output<void>();
}
