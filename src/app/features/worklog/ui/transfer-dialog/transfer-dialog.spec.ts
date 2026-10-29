import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Subject, of } from 'rxjs';
import { TransferDialog } from './transfer-dialog';
import { WORKLOG_REPOSITORY } from '../../data-access/worklog-repository';
import {
  emptyDocument,
  localDate,
  newItem,
  reconcile,
  WorklogDocument,
} from '../../domain/worklog';
import { exportCsv } from '../../domain/worklog-csv';
describe('CSV transfer dialog', () => {
  let saved: WorklogDocument;
  let fail: boolean;
  const ref = {
    keydownEvents: new Subject<KeyboardEvent>(),
    backdropClick: new Subject<void>(),
    closed: new Subject<void>(),
    close: vi.fn(),
  };
  const confirm = vi.fn(() => ({ closed: of(false) }));
  beforeEach(() => {
    saved = reconcile(emptyDocument(localDate()), localDate());
    fail = false;
    ref.close.mockClear();
    confirm.mockClear();
    TestBed.configureTestingModule({
      imports: [TransferDialog],
      providers: [
        { provide: DIALOG_DATA, useValue: { month: '2026-10' } },
        { provide: DialogRef, useValue: ref },
        {
          provide: WORKLOG_REPOSITORY,
          useValue: {
            read: () => saved,
            write: (document: WorklogDocument) => {
              if (fail) throw new Error('Storage full');
              saved = document;
              return saved;
            },
          },
        },
      ],
    });
    TestBed.overrideProvider(Dialog, { useValue: { open: confirm } });
  });
  afterEach(() => {
    ref.closed.next();
    TestBed.resetTestingModule();
  });
  it('previews without saving and preserves preview after a failed import for retry', () => {
    const fixture = TestBed.createComponent(TransferDialog);
    const dialog = fixture.componentInstance;
    const before = saved;
    const csv = exportCsv([newItem('2026-11-01', 'MEETING')]);
    dialog.text.set(csv);
    fixture.detectChanges();
    expect(saved).toBe(before);
    expect(dialog.counts().new).toBe(1);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Import 1 entries');
    fail = true;
    dialog.import();
    expect(dialog.text()).toBe(csv);
    expect(dialog.error()).toContain('Storage full');
    fail = false;
    dialog.import();
    expect(dialog.text()).toBeNull();
    expect(dialog.notice()).toBe('1 entries imported.');
    expect(saved.items).toHaveLength(before.items.length + 1);
  });
  it('blocks invalid imports and requests discard confirmation on Escape', async () => {
    const fixture = TestBed.createComponent(TransferDialog);
    const dialog = fixture.componentInstance;
    dialog.text.set(exportCsv([newItem('2026-02-30', 'MEETING')]));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector<HTMLButtonElement>('button.primary')?.disabled).toBe(true);
    ref.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(confirm).toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    expect(dialog.text()).not.toBeNull();
  });
  it('downloads CSV with a month or all-worklogs filename', () => {
    const fixture = TestBed.createComponent(TransferDialog);
    const dialog = fixture.componentInstance;
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const created: string[] = [];
    click.mockImplementation(function (this: HTMLAnchorElement) {
      created.push(this.download);
    });
    try {
      dialog.download();
      dialog.scope.set('all');
      dialog.download();
      expect(created).toEqual(['worklogs-2026-10.csv', 'worklogs-all.csv']);
      expect(create).toHaveBeenCalledTimes(2);
      const blob = create.mock.calls[0][0];
      expect(blob instanceof Blob && blob.type).toBe('text/csv;charset=utf-8');
    } finally {
      create.mockRestore();
      click.mockRestore();
    }
  });
  it('defaults to current month and offers all entries', () => {
    const fixture = TestBed.createComponent(TransferDialog);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector<HTMLSelectElement>('select')?.value).toBe('month');
    expect(element.querySelectorAll('select option')).toHaveLength(2);
  });
});
