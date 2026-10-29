import { Injectable, InjectionToken } from '@angular/core';
import { decodeDocument, WorklogDocument } from '../domain/worklog';
export const STORAGE_KEY = 'worktask.worklog.v1';
export interface WorklogRepository {
  read(): WorklogDocument | null;
  write(document: WorklogDocument, expectedRevision: number | null): WorklogDocument;
}
@Injectable({ providedIn: 'root' })
export class LocalStorageWorklogRepository implements WorklogRepository {
  read(): WorklogDocument | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === null ? null : decodeDocument(raw);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Cannot read worklog: ${error.message}`
          : 'Cannot access local storage.',
      );
    }
  }
  write(document: WorklogDocument, expectedRevision: number | null): WorklogDocument {
    const current = this.read();
    if ((current?.revision ?? null) !== expectedRevision)
      throw new Error(
        'Worklog changed in another tab. Keep your draft, then close and reload to review the latest data.',
      );
    const next = decodeDocument(
      JSON.stringify({ ...document, revision: (current?.revision ?? 0) + 1 }),
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        'Could not save worklog. Your changes are still here. Check browser storage and retry.',
      );
    }
    return next;
  }
}
export const WORKLOG_REPOSITORY = new InjectionToken<WorklogRepository>('WorklogRepository', {
  providedIn: 'root',
  factory: () => new LocalStorageWorklogRepository(),
});
