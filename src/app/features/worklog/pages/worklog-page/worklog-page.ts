import { TransferDialog } from '../../ui/transfer-dialog/transfer-dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { DestroyRef } from '@angular/core';
import { WorklogStore } from '../../data-access/worklog-store';
import { WorklogView, WorklogViewPreference } from '../../data-access/worklog-view-preference';
import {
  formatHours,
  isLoggedItem,
  localDate,
  monthDays,
  orderedItems,
  parseDate,
  shiftDate,
  workWeekDays,
  workWeekLabel,
} from '../../domain/worklog';
import { DayCell } from '../../ui/day-cell/day-cell';
import { MonthNavigation } from '../../ui/month-navigation/month-navigation';
import { DayDialog, DayDialogTab } from '../../ui/day-dialog/day-dialog';
@Component({
  selector: 'app-worklog-page',
  imports: [DayCell, MonthNavigation, DialogModule],
  templateUrl: './worklog-page.html',
  styleUrl: './worklog-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorklogPage {
  readonly store = inject(WorklogStore);
  constructor() {
    this.store.setBackgroundRefresh(true);
    inject(DestroyRef).onDestroy(() => this.store.setBackgroundRefresh(false));
  }
  private readonly dialogs = inject(Dialog);
  private readonly preference = inject(WorklogViewPreference);
  readonly view = signal<WorklogView>(this.preference.read());
  readonly preferenceError = signal('');
  readonly anchor = signal(this.store.today());
  readonly month = signal(this.store.today().slice(0, 7) + '-01');
  readonly selected = signal<string | null>(null);
  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly periodLabel = computed(() =>
    this.view() === 'work-week'
      ? workWeekLabel(this.anchor())
      : parseDate(this.month()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  );
  readonly visibleDates = computed(() =>
    this.view() === 'work-week' ? workWeekDays(this.anchor()) : monthDays(this.month()),
  );
  readonly cells = computed(() => {
    const document = this.store.document();
    return this.visibleDates().map((date) => ({
      date,
      items: orderedItems(document?.items.filter((item) => item.date === date) ?? []),
      off: document?.dayOffDates.includes(date) ?? false,
      today: date === this.store.today(),
      outside: this.view() === 'month' && date.slice(0, 7) !== this.month().slice(0, 7),
    }));
  });
  readonly totals = computed(() => {
    const dates = new Set(workWeekDays(this.anchor()));
    const items =
      this.store
        .document()
        ?.items.filter(isLoggedItem)
        .filter((item) =>
          this.view() === 'work-week'
            ? dates.has(item.date)
            : item.date.startsWith(this.month().slice(0, 7)),
        ) ?? [];
    return {
      count: items.length,
      hours: formatHours(items.reduce((sum, item) => sum + item.timeSpent, 0)),
      logged: items.filter((item) => item.timeLog).length,
    };
  });
  setView(view: WorklogView): void {
    if (this.store.editing()) return;
    if (view === 'month') this.month.set(this.anchor().slice(0, 7) + '-01');
    this.view.set(view);
    this.preferenceError.set(
      this.preference.write(view)
        ? ''
        : 'View changed, but your preference could not be saved on this device.',
    );
  }
  move(offset: number): void {
    if (this.store.editing()) return;
    if (this.view() === 'work-week') {
      this.anchor.update((date) => shiftDate(date, offset * 7));
    } else {
      const date = parseDate(this.month());
      date.setMonth(date.getMonth() + offset);
      this.month.set(localDate(date));
      const month = localDate(date).slice(0, 7);
      this.anchor.set(this.store.today().startsWith(month) ? this.store.today() : localDate(date));
    }
  }
  goToday(): void {
    if (!this.store.editing()) {
      this.anchor.set(this.store.today());
      this.month.set(this.store.today().slice(0, 7) + '-01');
    }
  }
  openTransfer(): void {
    if (this.store.editing() || !this.store.document()) return;
    this.store.editing.set(true);
    this.dialogs
      .open(TransferDialog, {
        data: { month: (this.view() === 'work-week' ? this.anchor() : this.month()).slice(0, 7) },
        ariaLabelledBy: 'transfer-title',
        disableClose: true,
        width: 'min(760px, calc(100vw - 24px))',
        maxWidth: '100vw',
        autoFocus: 'first-tabbable',
      })
      .closed.subscribe(() => {
        this.store.editing.set(false);
        this.store.load();
      });
  }
  open(date: string, itemId?: string, tab: DayDialogTab = 'worklog'): void {
    if (this.store.editing() || !this.store.document()) return;
    this.anchor.set(date);
    this.selected.set(date);
    this.store.editing.set(true);
    this.dialogs
      .open(DayDialog, {
        data: { date, itemId, tab },
        ariaLabelledBy: 'day-title',
        disableClose: true,
        width: 'min(820px, 100vw)',
        maxWidth: '100vw',
        panelClass: 'day-dialog-panel',
        autoFocus: 'first-tabbable',
      })
      .closed.subscribe(() => {
        this.selected.set(null);
        this.store.editing.set(false);
        this.store.load();
      });
  }
}
