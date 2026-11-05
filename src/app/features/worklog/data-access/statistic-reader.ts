import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { WORKLOG_REPOSITORY } from './worklog-repository';
import { WorkItem } from '../domain/worklog';
@Injectable()
export class StatisticReader {
  private readonly repository = inject(WORKLOG_REPOSITORY);
  readonly items = signal<readonly WorkItem[]>([]);
  readonly error = signal('');
  readonly loading = signal(false);
  private version = 0;
  constructor() {
    const refresh = () => void this.load();
    const visibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visibility);
    if (this.repository.identity)
      effect(() => {
        this.repository.identity?.();
        this.items.set([]);
        void this.load();
      });
    else void this.load();
    inject(DestroyRef).onDestroy(() => {
      this.version++;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visibility);
    });
  }
  async load(): Promise<void> {
    const version = ++this.version;
    const owner = this.repository.identity?.();
    this.items.set([]);
    if (this.repository.identity && !owner) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const saved = await this.repository.read();
      if (version !== this.version || owner !== this.repository.identity?.()) return;
      this.items.set(saved?.items ?? []);
      this.error.set('');
    } catch (error) {
      if (version === this.version)
        this.error.set(
          error instanceof Error ? error.message : 'Cannot read worklog. Please retry.',
        );
    } finally {
      if (version === this.version) this.loading.set(false);
    }
  }
}
