import { Injectable } from '@angular/core';
export type WorklogView = 'month' | 'work-week';
export const VIEW_STORAGE_KEY = 'worktask.worklog.view';
@Injectable({ providedIn: 'root' })
export class WorklogViewPreference {
  read(): WorklogView {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'work-week' ? 'work-week' : 'month';
    } catch {
      return 'month';
    }
  }
  write(view: WorklogView): boolean {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
      return true;
    } catch {
      return false;
    }
  }
}
