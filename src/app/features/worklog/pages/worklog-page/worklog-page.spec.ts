import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { WorklogPage } from './worklog-page';
import { WORKLOG_REPOSITORY } from '../../data-access/worklog-repository';
import { WorklogViewPreference } from '../../data-access/worklog-view-preference';
import {
  emptyDocument,
  localDate,
  newItem,
  newTodo,
  reconcile,
  WorklogDocument,
} from '../../domain/worklog';

describe('Worklog calendar views', () => {
  const preference = { read: () => 'month', write: vi.fn(() => true) };
  const closed = new Subject<void>();
  const dialog = { open: vi.fn(() => ({ closed })) };
  let saved = emptyDocument(localDate());
  const repository = {
    read: () => saved,
    write: vi.fn((document: WorklogDocument) => {
      saved = document;
      return saved;
    }),
  };
  beforeEach(() => {
    saved = reconcile(emptyDocument(localDate()), localDate());
    preference.write.mockReset().mockReturnValue(true);
    repository.write.mockClear();
    dialog.open.mockClear();
    TestBed.configureTestingModule({
      imports: [WorklogPage],
      providers: [
        provideRouter([]),
        { provide: WORKLOG_REPOSITORY, useValue: repository },
        { provide: WorklogViewPreference, useValue: preference },
      ],
    });
    TestBed.overrideProvider(Dialog, { useValue: dialog });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('excludes TODOs from work item counts, hours and logged totals in both views', async () => {
    const fixture = TestBed.createComponent(WorklogPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const before = page.totals();
    page.store.document.update((document) =>
      document
        ? {
            ...document,
            items: [...document.items, { ...newTodo(localDate()), title: 'Reminder' }],
          }
        : null,
    );
    expect(page.totals()).toEqual(before);
    page.setView('work-week');
    expect(page.totals()).toEqual(before);
  });
  it('replaces the device badge with a transfer button and uses the active period month', async () => {
    const fixture = TestBed.createComponent(WorklogPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.month.set('2026-09-01');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('button.local-badge');
    expect(button?.textContent).toContain('Import / Export');
    expect(element.textContent).not.toContain('This device');
    button?.click();
    expect(dialog.open).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { month: '2026-09' },
        ariaLabelledBy: 'transfer-title',
        disableClose: true,
      }),
    );
    closed.next();
    await fixture.whenStable();
    page.anchor.set('2026-11-02');
    page.setView('work-week');
    page.openTransfer();
    expect(dialog.open).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { month: '2026-11' } }),
    );
    closed.next();
    await fixture.whenStable();
    expect(page.store.editing()).toBe(false);
  });
  it('preserves anchors across view switches and navigates by the active period without writes', async () => {
    const fixture = TestBed.createComponent(WorklogPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.anchor.set('2026-10-31');
    page.setView('work-week');
    expect(page.visibleDates()[0]).toBe('2026-10-26');
    page.move(1);
    expect(page.anchor()).toBe('2026-11-07');
    page.setView('month');
    expect(page.month()).toBe('2026-11-01');
    page.setView('work-week');
    expect(page.anchor()).toBe('2026-11-07');
    page.goToday();
    expect(page.anchor()).toBe(page.store.today());
    page.setView('month');
    page.move(1);
    expect(page.anchor().endsWith('-01')).toBe(true);
    expect(repository.write).not.toHaveBeenCalled();
  });
  it('shows all cards in Work week and reacts to shared data changes', async () => {
    const fixture = TestBed.createComponent(WorklogPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.anchor.set('2026-10-26');
    const items = Array.from({ length: 4 }, () => newItem('2026-10-26', 'MEETING'));
    page.store.document.set({ ...saved, items });
    page.setView('work-week');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('app-day-cell')).toHaveLength(5);
    expect(element.querySelectorAll('app-work-item-card')).toHaveLength(4);
    expect(element.querySelector('[aria-pressed="true"]')?.textContent).toContain('Work week');
    expect(element.querySelector('[aria-label="Previous work week"]')).toBeTruthy();
    page.store.document.set({ ...saved, items: items.slice(1) });
    fixture.detectChanges();
    expect(element.querySelectorAll('app-work-item-card')).toHaveLength(3);
    page.setView('month');
    fixture.detectChanges();
    expect(page.totals().count).toBe(3);
    expect(element.querySelector('.overflow')?.textContent).toContain('+1 more');
  });
  it('opens the existing editor and protects drafts without moving the calendar trigger', async () => {
    const fixture = TestBed.createComponent(WorklogPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const month = page.month();
    page.open('2026-09-30', 'chosen-item');
    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { date: '2026-09-30', itemId: 'chosen-item', tab: 'worklog' },
        disableClose: true,
      }),
    );
    page.setView('work-week');
    page.move(1);
    page.goToday();
    expect(page.view()).toBe('month');
    expect(page.month()).toBe(month);
    expect(page.anchor()).toBe('2026-09-30');
    closed.next();
    await fixture.whenStable();
    expect(page.selected()).toBeNull();
    expect(page.store.editing()).toBe(false);
    page.setView('work-week');
    expect(page.anchor()).toBe('2026-09-30');
  });
  it('allows switching when preference persistence fails', async () => {
    const fixture = TestBed.createComponent(WorklogPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    preference.write.mockReturnValue(false);
    page.setView('work-week');
    expect(page.view()).toBe('work-week');
    expect(page.preferenceError()).toContain('could not be saved');
    expect(repository.write).not.toHaveBeenCalled();
  });
});
