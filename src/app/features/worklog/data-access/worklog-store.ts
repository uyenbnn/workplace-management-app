import { previewCsv } from '../domain/worklog-csv';
import { DestroyRef, Injectable, InjectionToken, effect, inject, signal } from '@angular/core';
import { WORKLOG_REPOSITORY } from './worklog-repository';
import { LocalWorklogMigration } from './local-worklog-migration';
import {
  emptyDocument,
  ItemValues,
  localDate,
  newItem,
  newTodo,
  reconcile,
  setDayOff,
  shiftDate,
  validateValues,
  WorkItem,
  LoggedWorkItem,
  Todo,
  TodoValues,
  WorklogDocument,
} from '../domain/worklog';
export const ENABLE_LOCAL_WORKLOG_IMPORT = new InjectionToken<boolean>('EnableLocalWorklogImport', {
  providedIn: 'root',
  factory: () => false,
});
@Injectable({ providedIn: 'root' })
export class WorklogStore {
  private readonly repository = inject(WORKLOG_REPOSITORY);
  readonly migration = inject(LocalWorklogMigration);
  readonly importEnabled = inject(ENABLE_LOCAL_WORKLOG_IMPORT);
  readonly document = signal<WorklogDocument | null>(null);
  readonly error = signal('');
  readonly today = signal(localDate());
  readonly editing = signal(false);
  readonly pending = signal(false);
  readonly loading = signal(false);
  private loaded = false;
  private backgroundRefreshEnabled = true;
  private version = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private writes = 0;
  private stale = false;
  private account: string | null | undefined;
  constructor() {
    if (this.repository.identity) {
      effect(() => {
        const owner = this.repository.identity?.();
        if (owner === this.account) return;
        this.account = owner;
        this.version++;
        this.document.set(null);
        this.error.set('');
        this.loaded = false;
        this.loading.set(false);
        this.stale = false;
        this.migration.reset();
        if (owner && this.backgroundRefreshEnabled) void this.load();
      });
      effect(() =>
        this.repository.editing?.set(this.editing() || this.pending() || this.migration.busy()),
      );
    } else void this.load();
    const refresh = () => {
      if (!this.backgroundRefreshEnabled) return;
      this.today.set(localDate());
      if (!this.editing() && !this.pending()) void this.load();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => {
      if (localDate() !== this.today()) refresh();
    }, 30_000);
    inject(DestroyRef).onDestroy(() => {
      this.version++;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visibility);
    });
  }
  async load(reviewDraft = false): Promise<void> {
    if (this.pending() || (this.editing() && !reviewDraft) || !this.backgroundRefreshEnabled)
      return;
    const owner = this.repository.identity?.();
    if (this.repository.identity && !owner) return;
    const version = ++this.version;
    this.loading.set(true);
    try {
      const existing = await this.repository.read();
      if (version !== this.version || owner !== this.repository.identity?.()) return;
      if (this.importEnabled && owner && (await this.migration.inspect(owner, existing))) {
        this.document.set(null);
        this.loaded = false;
        return;
      }
      if (version !== this.version || owner !== this.repository.identity?.()) return;
      const base = existing ?? emptyDocument(this.today());
      const next = reconcile(base, this.today());
      // Persist ledger changes even when no generated items were added.
      const changed = JSON.stringify(next) !== JSON.stringify(base);
      const saved =
        !existing || changed
          ? await this.repository.write(next, existing?.revision ?? null)
          : existing;
      if (version !== this.version || owner !== this.repository.identity?.()) return;
      this.document.set(saved);
      this.loaded = true;
      this.stale = false;
      this.error.set('');
    } catch (error) {
      if (version === this.version) this.error.set(this.message(error));
    } finally {
      if (version === this.version) this.loading.set(false);
    }
  }
  async importLocal(): Promise<void> {
    if (!this.importEnabled) return;
    const owner = this.repository.identity?.();
    if (owner && (await this.migration.transfer(this.repository, owner))) await this.load();
  }
  async continueCloud(): Promise<void> {
    if (!this.importEnabled) return;
    const owner = this.repository.identity?.();
    if (!owner || this.migration.busy()) return;
    await this.migration.continueCloud(owner);
    await this.load();
  }
  setBackgroundRefresh(enabled: boolean): void {
    this.backgroundRefreshEnabled = enabled;
    this.loading.set(false);
    this.version++;
    if (enabled) {
      this.today.set(localDate());
      void this.load();
    }
  }
  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'Worklog operation failed. Please retry.';
  }
  private commit(transform: (document: WorklogDocument) => WorklogDocument): Promise<boolean> {
    const owner = this.repository.identity?.();
    this.writes++;
    this.pending.set(true);
    const operation = this.queue
      .then(async () => {
        const current = this.document();
        if (owner !== this.repository.identity?.()) return false;
        if (!current || !this.loaded || this.stale || this.loading()) {
          this.error.set('Reload and review your worklog before editing. Your draft is preserved.');
          return false;
        }
        const version = ++this.version;
        try {
          const next = transform(current);
          const saved = await this.repository.write(next, current.revision);
          if (version !== this.version || owner !== this.repository.identity?.()) return false;
          this.document.set(saved);
          this.error.set('');
          return true;
        } catch (error) {
          if (version === this.version && owner === this.repository.identity?.()) {
            const message = this.message(error);
            this.stale = /another device|revision|stale|another tab/i.test(message);
            this.error.set(message);
          }
          return false;
        }
      })
      .finally(() => {
        this.writes--;
        this.pending.set(this.writes > 0);
      });
    this.queue = operation;
    return operation;
  }
  save(item: LoggedWorkItem, values: ItemValues): Promise<boolean> {
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
  saveTodo(item: Todo, values: TodoValues): Promise<boolean> {
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
  toggleTodo(id: string): Promise<boolean> {
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
  importCsv(text: string): Promise<boolean> {
    return this.commit((document) => {
      const preview = previewCsv(text);
      if (preview.invalid) throw new Error('Correct all invalid CSV rows before importing.');
      // Seal elapsed dates so replacement does not recreate removed defaults on reload.
      const processed = new Set(document.processedDates);
      for (let date = document.generationStartDate; date <= this.today(); date = shiftDate(date, 1))
        processed.add(date);
      preview.additions.forEach((item) => processed.add(item.date));
      return {
        ...document,
        items: preview.additions,
        dayOffDates: preview.dayOffAdditions,
        processedDates: [...processed].sort(),
      };
    });
  }
  remove(id: string): Promise<boolean> {
    return this.removeMany([id]);
  }
  removeMany(ids: readonly string[]): Promise<boolean> {
    const targets = new Set(ids);
    if (!targets.size) return Promise.resolve(false);
    return this.commit((document) => {
      if ([...targets].some((id) => !document.items.some((item) => item.id === id)))
        throw new Error('Some selected items are no longer available. Reload before deleting.');
      return { ...document, items: document.items.filter((item) => !targets.has(item.id)) };
    });
  }
  dayOff(date: string, off: boolean): Promise<boolean> {
    return this.commit((document) => setDayOff(document, date, off, this.today()));
  }
  draftTodo(date: string): Todo {
    return newTodo(date);
  }
  draft(date: string, type: 'MEETING' | 'WORK_ON_TASK'): LoggedWorkItem {
    return newItem(date, type);
  }
}
