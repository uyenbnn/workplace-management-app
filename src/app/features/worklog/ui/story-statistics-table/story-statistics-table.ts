import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { CdkScrollable } from '@angular/cdk/scrolling';
import {
  StatisticColumn,
  StatisticColumnDrafts,
  StatisticColumnFilters,
  StatisticSort,
  StoryStatistic,
} from '../../domain/story-statistics';
import { TaskStatus } from '../../domain/worklog';

@Component({
  imports: [DecimalPipe, OverlayModule, A11yModule, CdkScrollable],
  selector: 'app-story-statistics-table',
  styleUrl: './story-statistics-table.scss',
  templateUrl: './story-statistics-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryStatisticsTable {
  readonly rows = input.required<readonly StoryStatistic[]>();
  readonly sort = input.required<StatisticSort>();
  readonly filters = input.required<StatisticColumnFilters>();
  readonly drafts = input.required<StatisticColumnDrafts>();
  readonly errors = input.required<{ hours: string; count: string }>();
  readonly expanded = input.required<ReadonlySet<string>>();
  readonly sortChange = output<StatisticColumn>();
  readonly filtersChange = output<StatisticColumnDrafts>();
  readonly expansionChange = output<string>();
  readonly openColumn = signal<StatisticColumn | null>(null);
  readonly columns: readonly { key: StatisticColumn; label: string }[] = [
    { key: 'story', label: 'Story ID' },
    { key: 'hours', label: 'Hours' },
    { key: 'count', label: 'Entries' },
  ];
  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
  ];
  readonly statusLabels: Record<TaskStatus, string> = {
    TODO: 'To do',
    IN_PROGRESS: 'In progress',
    DONE: 'Done',
  };
  ariaSort(column: StatisticColumn): 'ascending' | 'descending' | 'none' {
    return this.sort().startsWith(column + '-')
      ? this.sort().endsWith('-asc')
        ? 'ascending'
        : 'descending'
      : 'none';
  }
  active(column: StatisticColumn): boolean {
    const filter = this.filters();
    return column === 'story'
      ? !!filter.story.trim()
      : filter[column].min !== null || filter[column].max !== null;
  }
  editStory(value: string): void {
    this.filtersChange.emit({ ...this.drafts(), story: value });
  }
  editRange(column: 'hours' | 'count', bound: 'min' | 'max', value: string): void {
    this.filtersChange.emit({
      ...this.drafts(),
      [column]: { ...this.drafts()[column], [bound]: value },
    });
  }
  clear(column: StatisticColumn): void {
    this.filtersChange.emit({
      ...this.drafts(),
      [column]: column === 'story' ? '' : { min: '', max: '' },
    });
  }
  toggleFilter(column: StatisticColumn): void {
    this.openColumn.update((current) => (current === column ? null : column));
  }
  close(): void {
    this.openColumn.set(null);
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }
}
