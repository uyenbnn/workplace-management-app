import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { WorklogStore } from '../../data-access/worklog-store';
import { Toast } from '../../../../core/notifications/toast';
import {
  LoggedItemType,
  ItemValues,
  itemTitle,
  formatHours,
  orderedItems,
  parseDate,
  WorkItem,
  Todo,
  LoggedWorkItem,
  isLoggedItem,
} from '../../domain/worklog';
import { TodoChecklist, TodoEdit } from '../todo-checklist/todo-checklist';
import { ItemForm } from '../item-form/item-form';
import { ConfirmDialog, ConfirmData } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
export type DayDialogTab = 'worklog' | 'todo';
export interface DayDialogData {
  tab?: DayDialogTab;
  date: string;
  itemId?: string;
}
@Component({
  selector: 'app-day-dialog',
  imports: [ItemForm, TodoChecklist],
  templateUrl: './day-dialog.html',
  styleUrl: './day-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayDialog {
  readonly data = inject<DayDialogData>(DIALOG_DATA);
  readonly store = inject(WorklogStore);
  readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly dialogs = inject(Dialog);
  private readonly toast = inject(Toast);
  private readonly itemForm = viewChild(ItemForm);
  readonly tab = signal<DayDialogTab>(this.data.tab ?? 'worklog');
  readonly selected = signal<LoggedWorkItem | null>(null);
  readonly todoDrafts = signal<ReadonlyMap<string, Todo>>(new Map());
  readonly todoErrors = signal<Readonly<Record<string, string>>>({});
  readonly todoRows = computed(() => {
    const drafts = this.todoDrafts();
    const saved = this.todos();
    return [
      ...saved.map((item) => {
        const draft = drafts.get(item.id);
        return draft ? { ...item, title: draft.title } : item;
      }),
      ...[...drafts.values()].filter((item) => !saved.some((entry) => entry.id === item.id)),
    ];
  });
  readonly checked = signal<ReadonlySet<string>>(new Set());
  readonly checkedItems = computed(() =>
    this.items().filter((item) => this.checked().has(item.id)),
  );
  readonly allChecked = computed(
    () => this.items().length > 0 && this.checkedItems().length === this.items().length,
  );
  readonly dirty = signal(false);
  readonly notice = signal('');
  private confirming = false;
  private deletingTodoId: string | null = null;
  readonly label = parseDate(this.data.date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  readonly items = computed(() =>
    orderedItems(
      this.store.document()?.items.filter((item) => item.date === this.data.date) ?? [],
    ).filter(isLoggedItem),
  );
  readonly todos = computed(() =>
    orderedItems(
      this.store
        .document()
        ?.items.filter((item) => item.date === this.data.date && item.type === 'TODO') ?? [],
    ).filter((item): item is Todo => item.type === 'TODO'),
  );
  readonly off = computed(
    () => this.store.document()?.dayOffDates.includes(this.data.date) ?? false,
  );
  readonly title = itemTitle;
  readonly hours = formatHours;
  constructor() {
    this.selected.set(
      this.items().find((item) => item.id === this.data.itemId) ?? this.items()[0] ?? null,
    );
    const escape = this.ref.keydownEvents.subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void this.close();
      }
    });
    const backdrop = this.ref.backdropClick.subscribe(() => void this.close());
    this.ref.closed.subscribe(() => {
      escape.unsubscribe();
      backdrop.unsubscribe();
    });
  }
  private async confirm(data: ConfirmData): Promise<boolean> {
    if (this.confirming) return false;
    this.confirming = true;
    try {
      return (
        (await firstValueFrom(
          this.dialogs.open<boolean>(ConfirmDialog, {
            data,
            ariaLabelledBy: 'confirm-title',
            autoFocus: 'first-tabbable',
            width: 'min(440px, calc(100vw - 32px))',
          }).closed,
        )) === true
      );
    } finally {
      this.confirming = false;
    }
  }
  private async discard(): Promise<boolean> {
    return (
      !this.dirty() ||
      this.confirm({
        title: 'Discard unsaved changes?',
        message: 'Your saved worklog will remain unchanged.',
        action: 'Discard changes',
      })
    );
  }
  async choose(item: LoggedWorkItem): Promise<void> {
    this.tryAutoSave();
    if (await this.discard()) {
      this.selected.set(this.items().find((entry) => entry.id === item.id) ?? item);
      this.dirty.set(false);
      this.notice.set('');
    }
  }
  async add(type: LoggedItemType): Promise<void> {
    this.tryAutoSave();
    if (await this.discard()) {
      this.selected.set(this.store.draft(this.data.date, type));
      this.dirty.set(true);
      this.notice.set('');
    }
  }
  save(values: ItemValues): void {
    const item = this.selected();
    if (item && this.store.save(item, values)) {
      this.selected.set(this.items().find((entry) => entry.id === item.id) ?? null);
      this.dirty.set(false);
      this.notice.set('');
      this.toast.success('Item saved.');
    }
  }
  autoSave(values: ItemValues): void {
    if (!this.confirming && this.dirty()) this.save(values);
  }
  private tryAutoSave(): void {
    if (!this.confirming && this.dirty()) this.itemForm()?.autoSave();
  }
  selectTab(tab: DayDialogTab): void {
    if (this.tab() === 'worklog' && tab !== 'worklog') this.tryAutoSave();
    if (this.tab() === 'todo' && tab !== 'todo') this.saveTodoDrafts();
    this.tab.set(tab);
  }
  navigateTabs(event: KeyboardEvent, worklog: HTMLButtonElement, todo: HTMLButtonElement): void {
    let tab: DayDialogTab;
    if (event.key === 'Home') tab = 'worklog';
    else if (event.key === 'End') tab = 'todo';
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      tab = this.tab() === 'worklog' ? 'todo' : 'worklog';
    else return;
    event.preventDefault();
    this.selectTab(tab);
    (tab === 'worklog' ? worklog : todo).focus();
  }
  readonly todoFocusId = signal<string | undefined>(undefined);
  createTodoAfter(item: Todo): void {
    this.saveTodo(item);
    if (this.todoDrafts().has(item.id) || this.todoErrors()[item.id]) return;
    this.addTodo();
  }
  addTodo(): void {
    const item = this.store.draftTodo(this.data.date);
    this.todoDrafts.update((drafts) => new Map([...drafts, [item.id, item]]));
    this.todoFocusId.set(item.id);
  }
  editTodo({ item, values }: TodoEdit): void {
    const saved = this.todos().find((entry) => entry.id === item.id);
    this.todoDrafts.update((drafts) => {
      const next = new Map(drafts);
      if (saved && saved.title === values.title) next.delete(item.id);
      else next.set(item.id, { ...item, ...values });
      return next;
    });
    this.clearTodoError(item.id);
  }
  private clearTodoError(id: string): void {
    this.todoErrors.update((errors) => {
      const next = { ...errors };
      delete next[id];
      return next;
    });
  }
  saveTodo(item: Todo): void {
    const draft = this.todoDrafts().get(item.id);
    if (!draft || this.deletingTodoId === item.id) return;
    if (!draft.title.trim()) {
      this.todoErrors.update((errors) => ({ ...errors, [item.id]: 'Enter a TODO title.' }));
      return;
    }
    if (this.store.saveTodo(draft, { title: draft.title })) {
      this.todoDrafts.update((drafts) => {
        const next = new Map(drafts);
        next.delete(item.id);
        return next;
      });
      this.clearTodoError(item.id);
      this.notice.set('TODO saved.');
    } else this.todoErrors.update((errors) => ({ ...errors, [item.id]: this.store.error() }));
  }
  private saveTodoDrafts(): void {
    for (const item of this.todoDrafts().values()) this.saveTodo(item);
  }
  toggleTodo(id: string): void {
    if (!this.todos().some((entry) => entry.id === id)) {
      const draft = this.todoDrafts().get(id);
      if (draft) this.saveTodo(draft);
    }
    const item = this.todos().find((entry) => entry.id === id);
    if (item) {
      if (this.store.toggleTodo(id)) this.notice.set('TODO completion saved.');
    }
  }
  async removeTodo(item: Todo): Promise<void> {
    if (this.confirming) return;
    const saved = this.todos().some((entry) => entry.id === item.id);
    this.deletingTodoId = item.id;
    try {
      if (
        saved &&
        !(await this.confirm({
          title: 'Delete TODO?',
          message:
            'Delete ' +
            item.title +
            ' from ' +
            this.label +
            '? This cannot be undone.' +
            (this.todoDrafts().has(item.id)
              ? ' Unsaved changes to this TODO will also be discarded.'
              : ''),
          action: 'Delete TODO',
        }))
      )
        return;
      if (!saved || this.store.remove(item.id)) {
        this.todoDrafts.update((drafts) => {
          const next = new Map(drafts);
          next.delete(item.id);
          return next;
        });
        this.clearTodoError(item.id);
        if (saved) this.toast.success('TODO deleted.');
      }
    } finally {
      this.deletingTodoId = null;
    }
  }
  async cancel(): Promise<void> {
    if (await this.discard()) {
      this.selected.set(null);
      this.dirty.set(false);
      this.notice.set('Changes cancelled.');
    }
  }
  toggleChecked(id: string): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  toggleAll(): void {
    this.checked.set(this.allChecked() ? new Set() : new Set(this.items().map((item) => item.id)));
  }
  async removeChecked(): Promise<void> {
    if (this.confirming) return;
    const items = this.checkedItems();
    if (!items.length) return;
    const ids = items.map((item) => item.id);
    const removesEditor = ids.includes(this.selected()?.id ?? '');
    const discardWarning =
      removesEditor && this.dirty()
        ? ' Unsaved changes to the item being deleted will also be discarded.'
        : '';
    if (
      !(await this.confirm({
        title: `Delete ${items.length} selected items?`,
        message: `Permanently delete ${items.length} work items from ${this.label}: ${items.map(itemTitle).join(', ')}? This includes any selected logged entries and cannot be undone.${discardWarning}`,
        action: 'Delete selected',
      }))
    )
      return;
    if (this.store.removeMany(ids)) {
      this.checked.set(new Set());
      if (removesEditor) {
        this.selected.set(null);
        this.dirty.set(false);
      }
      this.notice.set('');
      this.toast.success(`${items.length} work items deleted.`);
    }
  }
  async remove(): Promise<void> {
    const item = this.selected();
    if (!item) return;
    if (
      await this.confirm({
        title: 'Delete item?',
        message: `Delete ${itemTitle(item)} from ${this.label}? This cannot be undone.`,
        action: 'Delete item',
      })
    ) {
      if (this.store.remove(item.id)) {
        this.checked.update((current) => new Set([...current].filter((id) => id !== item.id)));
        this.selected.set(null);
        this.dirty.set(false);
        this.notice.set('');
        this.toast.success('Item deleted.');
      }
    }
  }
  async toggleOff(): Promise<void> {
    if (!(await this.discard())) return;
    const off = !this.off();
    if (
      off &&
      this.items().length &&
      !(await this.confirm({
        title: 'Mark as day off?',
        message: `All ${this.items().length} entries on ${this.label}, including logged and manual work entries, will be permanently removed. TODO reminders will be kept.`,
        action: 'Delete entries and mark off',
      }))
    )
      return;
    if (this.store.dayOff(this.data.date, off)) {
      this.checked.set(new Set());
      this.selected.set(null);
      this.dirty.set(false);
      this.notice.set(off ? 'Day off saved.' : 'Day off removed.');
    }
  }
  async close(): Promise<void> {
    if (this.confirming) return;
    this.tryAutoSave();
    this.saveTodoDrafts();
    if (this.todoDrafts().size) {
      if (
        await this.confirm({
          title: 'Discard unsaved changes?',
          message:
            'Some TODO reminders could not be saved. Discard their pending edits' +
            (this.dirty() ? ' and your worklog edits' : '') +
            '?',
          action: 'Discard changes',
        })
      )
        this.ref.close();
    } else if (await this.discard()) this.ref.close();
  }
  isSaved(item: WorkItem): boolean {
    return [...this.items(), ...this.todos()].some((entry) => entry.id === item.id);
  }
  formChanged(changed: boolean): void {
    const item = this.selected();
    this.dirty.set(changed || (item !== null && !this.isSaved(item)));
  }
}
