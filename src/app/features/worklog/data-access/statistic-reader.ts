import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEY, WORKLOG_REPOSITORY } from './worklog-repository';
import { WorkItem } from '../domain/worklog';

@Injectable()
export class StatisticReader {
  private readonly repository = inject(WORKLOG_REPOSITORY);
  readonly items = signal<readonly WorkItem[]>([]);
  readonly error = signal('');

  constructor() {
    const refresh = () => this.load();
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) this.load();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') this.load();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
    });
    this.load();
  }
  load(): void {
    try {
      this.items.set(this.repository.read()?.items ?? []);
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Cannot read worklog. Please retry.');
    }
  }
}
