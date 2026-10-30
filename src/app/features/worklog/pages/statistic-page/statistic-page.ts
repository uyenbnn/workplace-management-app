import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { StatisticReader } from '../../data-access/statistic-reader';
import {
  emptyColumnDrafts,
  emptyColumnFilters,
  nextStatisticSort,
  parseStatisticRange,
  StatisticColumn,
  StatisticColumnDrafts,
  StatisticSort,
  storyStatistics,
} from '../../domain/story-statistics';
import { StoryStatisticsTable } from '../../ui/story-statistics-table/story-statistics-table';

@Component({
  imports: [StoryStatisticsTable],
  providers: [StatisticReader],
  selector: 'app-statistic-page',
  styleUrl: './statistic-page.scss',
  templateUrl: './statistic-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticPage {
  readonly reader = inject(StatisticReader);
  readonly sort = signal<StatisticSort>('hours-desc');
  readonly columnDrafts = signal(emptyColumnDrafts());
  readonly columnFilters = signal(emptyColumnFilters());
  readonly columnErrors = computed(() => ({
    hours: parseStatisticRange(this.columnDrafts().hours, false).error,
    count: parseStatisticRange(this.columnDrafts().count, true).error,
  }));
  readonly groups = computed(() =>
    storyStatistics(this.reader.items(), {
      search: '',
      start: '',
      end: '',
      sort: this.sort(),
      columns: this.columnFilters(),
    }),
  );
  readonly summary = computed(() => ({
    hours: this.groups().reduce((sum, group) => sum + group.hours, 0),
    entries: this.groups().reduce((sum, group) => sum + group.count, 0),
  }));
  readonly hasTasks = computed(() =>
    this.reader.items().some((item) => item.type === 'WORK_ON_TASK'),
  );
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  updateColumns(drafts: StatisticColumnDrafts): void {
    this.columnDrafts.set(drafts);
    const hours = parseStatisticRange(drafts.hours, false);
    const count = parseStatisticRange(drafts.count, true);
    this.columnFilters.update((current) => ({
      story: drafts.story,
      hours: hours.range ?? current.hours,
      count: count.range ?? current.count,
    }));
  }
  sortBy(column: StatisticColumn): void {
    this.sort.update((current) => nextStatisticSort(current, column));
  }
  toggle(storyId: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }
}
