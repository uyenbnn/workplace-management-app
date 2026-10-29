import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { parseDate, WorkItem, isLoggedItem, todoProgress } from '../../domain/worklog';
import { WorkItemCard } from '../work-item-card/work-item-card';
@Component({
  selector: 'app-day-cell',
  imports: [WorkItemCard],
  templateUrl: './day-cell.html',
  styleUrl: './day-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayCell {
  readonly layout = input<'month' | 'work-week'>('month');
  readonly date = input.required<string>();
  readonly items = input<WorkItem[]>([]);
  readonly workItems = computed(() => this.items().filter(isLoggedItem));
  readonly todos = computed(() => this.items().filter((item) => item.type === 'TODO'));
  readonly progress = computed(() => todoProgress(this.items()));
  readonly today = input(false);
  readonly outside = input(false);
  readonly off = input(false);
  readonly selected = input(false);
  readonly openTodos = output<void>();
  readonly open = output<string | undefined>();
  readonly types = computed(() =>
    [
      this.items().some((item) => item.type === 'MEETING') ? 'M' : '',
      this.items().some((item) => item.type === 'WORK_ON_TASK') ? 'T' : '',
    ]
      .filter(Boolean)
      .join(' \u00b7 '),
  );
  readonly day = computed(() =>
    this.layout() === 'month'
      ? String(parseDate(this.date()).getDate())
      : parseDate(this.date()).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
  );
  readonly weekend = computed(() => [0, 6].includes(parseDate(this.date()).getDay()));
  readonly label = computed(
    () =>
      `${parseDate(this.date()).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${this.workItems().length} work items, ${this.progress() || 'no TODOs'}${this.off() ? ', day off' : ''}`,
  );
}
