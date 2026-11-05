import { Injectable, signal } from '@angular/core';
import { decodeDocument, WorklogDocument } from '../domain/worklog';
import type { WorklogRepository } from './worklog-repository';
const KEY = 'worktask.worklog.v1';
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}
async function fingerprint(raw: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function sameDocumentContent(left: WorklogDocument, right: WorklogDocument): boolean {
  return (
    JSON.stringify(canonical({ ...left, revision: 0 })) ===
    JSON.stringify(canonical({ ...right, revision: 0 }))
  );
}
@Injectable({ providedIn: 'root' })
export class LocalWorklogMigration {
  readonly pending = signal(false);
  readonly local = signal<WorklogDocument | null>(null);
  readonly raw = signal<string | null>(null);
  readonly error = signal('');
  readonly cloudExists = signal(false);
  readonly busy = signal(false);
  private version = 0;
  private acknowledged = new Set<string>();
  reset(): void {
    this.version++;
    this.pending.set(false);
    this.local.set(null);
    this.raw.set(null);
    this.error.set('');
    this.cloudExists.set(false);
  }
  async inspect(owner: string, cloud: WorklogDocument | null): Promise<boolean> {
    const version = this.version;
    if (this.acknowledged.has(owner)) return false;

    try {
      const raw = localStorage.getItem(KEY);
      this.raw.set(raw);
      if (raw !== null) {
        const digest = await fingerprint(raw);
        if (version !== this.version) return false;
        if (localStorage.getItem('worktask.worklog.migrated.' + owner) === digest) {
          this.acknowledged.add(owner);
          return false;
        }
      }
      if (raw === null) {
        this.acknowledged.add(owner);
        return false;
      }
      this.pending.set(true);
      const local = decodeDocument(raw);
      this.local.set(local);
      this.cloudExists.set(cloud !== null && !sameDocumentContent(cloud, local));
      this.error.set('');
    } catch (error) {
      this.pending.set(true);
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Cannot read local backup. No cloud document has been created.',
      );
    }
    return this.pending();
  }
  async continueCloud(owner: string): Promise<void> {
    const raw = this.raw();
    if (raw !== null) {
      try {
        localStorage.setItem('worktask.worklog.migrated.' + owner, await fingerprint(raw));
      } catch {
        /* Original data remains intact; review may reappear on reload. */
      }
    }
    this.acknowledged.add(owner);
    this.pending.set(false);
    this.error.set('');
  }
  async transfer(repository: WorklogRepository, owner: string): Promise<boolean> {
    const local = this.local();
    if (!local || this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      const current = await repository.read();
      if (repository.identity?.() !== owner) return false;
      // A previous request may have committed even if its response was lost.
      if (current && !sameDocumentContent(current, local)) {
        this.cloudExists.set(true);
        throw new Error(
          'This account already has a different cloud worklog. Automatic import is blocked. Download the local backup and continue with cloud data.',
        );
      }
      if (!current) await repository.write(local, null);
      const verified = await repository.read();
      if (repository.identity?.() !== owner) return false;
      if (!verified || !sameDocumentContent(verified, local))
        throw new Error(
          'Cloud verification did not match. Local data is preserved; retry verification.',
        );
      await this.continueCloud(owner);
      return true;
    } catch (error) {
      if (repository.identity?.() === owner)
        this.error.set(error instanceof Error ? error.message : 'Import failed. Retry safely.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  download(): void {
    const raw = this.raw();
    if (raw === null) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'worklog-local-backup.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
