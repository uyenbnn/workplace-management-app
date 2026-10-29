import { previewCsv } from '../domain/worklog-csv';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { WORKLOG_REPOSITORY, STORAGE_KEY } from './worklog-repository';
import {
  emptyDocument,
  ItemValues,
  localDate,
  newItem,
  newTodo,
  reconcile,
  setDayOff,
  validateValues,
  WorkItem,
  LoggedWorkItem,
  Todo,
  TodoValues,
  WorklogDocument,
} from '../domain/worklog';
@Injectable({ providedIn: 'root' })
export class WorklogStore {
  private readonly repository = inject(WORKLOG_REPOSITORY);
  readonly document = signal<WorklogDocument | null>(null);
  readonly error = signal('');
  readonly today = signal(localDate());
  readonly editing = signal(false);
  private loaded = false;
  constructor() {
    const refresh = () => {
      this.today.set(localDate());
      if (!this.editing()) this.load();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        if (this.editing())
          this.error.set(
            'Worklog changed in another tab. Close your draft and reload before saving.',
          );
        else this.load();
      }
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => {
      if (localDate() !== this.today()) refresh();
    }, 30_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
    });
    this.load();
  }
  load(): void {
    try {
      const existing = this.repository.read();
      const base = existing ?? emptyDocument(this.today());
      const next = reconcile(base, this.today());
      this.document.set(existing ?? base);
      if (!existing || next.items.length !== base.items.length)
        this.document.set(this.repository.write(next, existing?.revision ?? null));
      this.loaded = true;
      this.error.set('');
    } catch (error) {
      this.error.set(this.message(error));
    }
  }
  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'Worklog operation failed. Please retry.';
  }
  private commit(transform: (document: WorklogDocument) => WorklogDocument): boolean {
    const current = this.document();
    if (!current || !this.loaded) {
      this.error.set('Storage is unavailable. Reload your worklog before editing.');
      return false;
    }
    try {
      const next = transform(current);
      this.document.set(this.repository.write(next, current.revision));
      this.error.set('');
      return true;
    } catch (error) {
      this.error.set(this.message(error));
      return false;
    }
  }
  save(item: LoggedWorkItem, values: ItemValues): boolean {
    return this.commit((document) => {
      if (document.dayOffDates.includes(item.date))
        throw new Error('Remove day off before adding work.');
      validateValues(item.type, values);
      const updated: WorkItem =
        item.type === 'MEETING'
          ? {
              ...item,
              timeSpent: values.timeSpent,
              timeLog: values.timeLog,
              updatedAt: new Date().toISOString(),
            }
          : {
              ...item,
              ...values,
              name: values.name.trim(),
              storyId: values.storyId.trim(),
              updatedAt: new Date().toISOString(),
            };
      const exists = document.items.some((entry) => entry.id === item.id);
      const previous = document.items.find((entry) => entry.id === item.id) ?? item;
      const syncStatus =
        updated.type === 'WORK_ON_TASK' &&
        previous.type === 'WORK_ON_TASK' &&
        updated.status !== previous.status &&
        updated.storyId !== '';
      const items = exists
        ? document.items.map((entry) => (entry.id === item.id ? updated : entry))
        : [...document.items, updated];
      return {
        ...document,
        items: items.map((entry) =>
          syncStatus &&
          updated.type === 'WORK_ON_TASK' &&
          entry.type === 'WORK_ON_TASK' &&
          entry.storyId.trim() === updated.storyId &&
          entry.status !== updated.status
            ? { ...entry, status: updated.status, updatedAt: updated.updatedAt }
            : entry,
        ),
      };
    });
  }
  saveTodo(item: Todo, values: TodoValues): boolean {
    return this.commit((document) => {
      if (!values.title.trim()) throw new Error('Enter a TODO title.');
      const previous = document.items.find((entry) => entry.id === item.id);
      if (previous && previous.type !== 'TODO') throw new Error('This item is not a TODO.');
      const updated: Todo = {
        ...item,
        title: values.title.trim(),
        completed: previous?.type === 'TODO' ? previous.completed : false,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...document,
        items: previous
          ? document.items.map((entry) => (entry.id === item.id ? updated : entry))
          : [...document.items, updated],
      };
    });
  }
  toggleTodo(id: string): boolean {
    return this.commit((document) => {
      const item = document.items.find((entry) => entry.id === id);
      if (!item || item.type !== 'TODO')
        throw new Error('TODO is no longer available. Reload before editing.');
      return {
        ...document,
        items: document.items.map((entry) =>
          entry.id === id
            ? { ...item, completed: !item.completed, updatedAt: new Date().toISOString() }
            : entry,
        ),
      };
    });
  }
  importCsv(text: string): boolean {
    return this.commit((document) => {
      const preview = previewCsv(text, document);
      if (preview.invalid) throw new Error('Correct all invalid CSV rows before importing.');
      if (!preview.additions.length) throw new Error('No new entries to import.');
      return { ...document, items: [...document.items, ...preview.additions] };
    });
  }
  remove(id: string): boolean {
    return this.removeMany([id]);
  }
  removeMany(ids: readonly string[]): boolean {
    const targets = new Set(ids);
    if (!targets.size) return false;
    return this.commit((document) => {
      if ([...targets].some((id) => !document.items.some((item) => item.id === id)))
        throw new Error('Some selected items are no longer available. Reload before deleting.');
      return { ...document, items: document.items.filter((item) => !targets.has(item.id)) };
    });
  }
  dayOff(date: string, off: boolean): boolean {
    return this.commit((document) => setDayOff(document, date, off, this.today()));
  }
  draftTodo(date: string): Todo {
    return newTodo(date);
  }
  draft(date: string, type: 'MEETING' | 'WORK_ON_TASK'): LoggedWorkItem {
    return newItem(date, type);
  }
}
