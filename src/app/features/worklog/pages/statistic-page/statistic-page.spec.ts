import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StatisticPage } from './statistic-page';
import {
  LocalStorageWorklogRepository,
  STORAGE_KEY,
  WORKLOG_REPOSITORY,
} from '../../data-access/worklog-repository';
import { emptyDocument, localDate, newItem, Task, WorklogDocument } from '../../domain/worklog';

function task(id: string, name: string, minutes: number): Task {
  const item = newItem(localDate(), 'WORK_ON_TASK');
  if (item.type !== 'WORK_ON_TASK') throw new Error('Expected task');
  return { ...item, id, name, storyId: ' story-1 ', timeSpent: minutes };
}
describe('Statistics page', () => {
  let saved: WorklogDocument | null;
  let fail: boolean;
  const write = vi.fn();
  beforeEach(() => {
    saved = {
      ...emptyDocument(localDate()),
      items: [task('a', 'API work', 90), task('b', 'Layout', 30)],
    };
    fail = false;
    write.mockReset();
    TestBed.configureTestingModule({
      imports: [StatisticPage],
      providers: [
        provideRouter([]),
        {
          provide: WORKLOG_REPOSITORY,
          useValue: {
            read: () => {
              if (fail) throw new Error('Cannot read storage');
              return saved;
            },
            write,
          },
        },
      ],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('renders matching summaries, expands details with native button semantics and clears column filters', async () => {
    const fixture = TestBed.createComponent(StatisticPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    expect(page.summary()).toEqual({ hours: 2, entries: 2 });
    const expand = element.querySelector<HTMLButtonElement>('button.expand');
    expect(expand?.getAttribute('aria-expanded')).toBe('false');
    expand?.click();
    await fixture.whenStable();
    expect(expand?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelectorAll('.entries li')).toHaveLength(2);
    expect(element.querySelector('.entries')?.textContent).toContain('Not logged externally');
    page.updateColumns({ ...page.columnDrafts(), hours: { min: '3', max: '' } });
    await fixture.whenStable();
    expect(page.summary()).toEqual({ hours: 0, entries: 0 });
    expect(element.querySelectorAll('.entries li')).toHaveLength(0);
    page.updateColumns({ story: '', hours: { min: '', max: '' }, count: { min: '', max: '' } });
    await fixture.whenStable();
    expect(page.summary()).toEqual({ hours: 2, entries: 2 });
    expect(page.expanded().has('STORY-1')).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it('shows all saved dates without a toolbar and reloads with clear column filters', async () => {
    saved = {
      ...emptyDocument(localDate()),
      items: [
        { ...task('old', 'Older task', 60), date: '2020-01-01' },
        task('today', 'Current task', 120),
      ],
    };
    const fixture = TestBed.createComponent(StatisticPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('input[type="search"]')).toBeNull();
    expect(element.querySelector('input[type="date"]')).toBeNull();
    expect(element.textContent).not.toContain('Reset filters');
    expect(page.summary()).toEqual({ hours: 3, entries: 2 });
    page.updateColumns({ ...page.columnDrafts(), hours: { min: '4', max: '' } });
    expect(page.groups()).toEqual([]);
    fixture.destroy();
    const reload = TestBed.createComponent(StatisticPage);
    expect(reload.componentInstance.summary()).toEqual({ hours: 3, entries: 2 });
    expect(reload.componentInstance.sort()).toBe('hours-desc');
    expect(write).not.toHaveBeenCalled();
  });
  it('retains last valid numeric filters on invalid edits, updates visible summaries and clears per column', async () => {
    const fixture = TestBed.createComponent(StatisticPage);
    const page = fixture.componentInstance;
    page.toggle('STORY-1');
    page.updateColumns({ ...page.columnDrafts(), hours: { min: '2', max: '2' } });
    expect(page.summary()).toEqual({ hours: 2, entries: 2 });
    page.updateColumns({ ...page.columnDrafts(), hours: { min: '4', max: '2' } });
    expect(page.columnErrors().hours).toContain('Maximum');
    expect(page.summary()).toEqual({ hours: 2, entries: 2 });
    page.updateColumns({ ...page.columnDrafts(), hours: { min: '4', max: '' } });
    expect(page.summary()).toEqual({ hours: 0, entries: 0 });
    expect(page.expanded().has('STORY-1')).toBe(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('thead button')).toHaveLength(6);
    page.sortBy('story');
    page.updateColumns({ story: '', hours: { min: '', max: '' }, count: { min: '', max: '' } });
    expect(page.columnDrafts().hours).toEqual({ min: '', max: '' });
    expect(page.columnErrors().hours).toBe('');
    expect(page.sort()).toBe('story-asc');
    expect(page.summary()).toEqual({ hours: 2, entries: 2 });
    expect(page.expanded().has('STORY-1')).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it('refreshes after repository changes and distinguishes empty, no matches, and failed reads', async () => {
    const fixture = TestBed.createComponent(StatisticPage);
    const page = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();
    saved = { ...emptyDocument(localDate()), items: [task('new', 'New task', 240)] };
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    await fixture.whenStable();
    expect(page.summary()).toEqual({ hours: 4, entries: 1 });
    page.updateColumns({ ...page.columnDrafts(), story: 'not found' });
    await fixture.whenStable();
    expect(element.textContent).toContain('No matching tasks');
    fail = true;
    window.dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    expect(element.querySelector('.error[role="alert"]')?.textContent).toContain(
      'Cannot read storage',
    );
    expect(element.querySelector('.summary')).toBeNull();
    fail = false;
    saved = null;
    element.querySelector<HTMLButtonElement>('.error button')?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('No task worklogs yet');
    expect(write).not.toHaveBeenCalled();
  });
  it('preserves corrupt local storage and never creates defaults on initial or refreshed reads', async () => {
    TestBed.overrideProvider(WORKLOG_REPOSITORY, { useValue: new LocalStorageWorklogRepository() });
    localStorage.setItem(STORAGE_KEY, '{broken');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const fixture = TestBed.createComponent(StatisticPage);
      await fixture.whenStable();
      expect(fixture.componentInstance.reader.error()).toContain('Cannot read worklog');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
      localStorage.removeItem(STORAGE_KEY);
      fixture.componentInstance.reader.load();
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
      localStorage.removeItem(STORAGE_KEY);
    }
  });
  it('removes refresh listeners when the page is destroyed', () => {
    const fixture = TestBed.createComponent(StatisticPage);
    const reader = fixture.componentInstance.reader;
    const load = vi.spyOn(reader, 'load');
    fixture.destroy();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    expect(load).not.toHaveBeenCalled();
  });
});
