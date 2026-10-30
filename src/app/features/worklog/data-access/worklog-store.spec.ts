import { exportCsv } from '../domain/worklog-csv';
import { TestBed } from '@angular/core/testing';
import { WorklogStore } from './worklog-store';
import { WORKLOG_REPOSITORY, WorklogRepository } from './worklog-repository';
import {
  emptyDocument,
  newTodo,
  newItem,
  reconcile,
  Task,
  WorklogDocument,
} from '../domain/worklog';
describe('Worklog state operations', () => {
  let saved: WorklogDocument;
  let fail: boolean;
  let repository: WorklogRepository;
  beforeEach(() => {
    saved = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    fail = false;
    repository = {
      read: () => saved,
      write: (document, revision) => {
        if (fail) throw new Error('Storage full');
        if (revision !== saved.revision) throw new Error('Stale revision');
        saved = { ...document, revision: saved.revision + 1 };
        return saved;
      },
    };
    TestBed.configureTestingModule({
      providers: [{ provide: WORKLOG_REPOSITORY, useValue: repository }],
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 12));
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('suspends generation outside the tracker and resumes chronological backfill on return', () => {
    const store = TestBed.inject(WorklogStore);
    const write = vi.spyOn(repository, 'write');
    const before = structuredClone(saved);
    store.setBackgroundRefresh(false);
    vi.setSystemTime(new Date(2026, 9, 28, 12));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    vi.advanceTimersByTime(30_000);
    expect(write).not.toHaveBeenCalled();
    expect(saved).toEqual(before);
    store.setBackgroundRefresh(true);
    expect(store.today()).toBe('2026-10-28');
    expect(saved.items.filter((item) => item.date === '2026-10-27')).toHaveLength(2);
    expect(saved.items.filter((item) => item.date === '2026-10-28')).toHaveLength(2);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('persists imported TODOs and days off atomically and retains state on failure', () => {
    const store = TestBed.inject(WorklogStore);
    const date = '2026-11-02';
    const todo = { ...newTodo(date), title: 'Review', completed: true };
    const csv = exportCsv([todo], undefined, [date]);
    const before = structuredClone(saved);
    fail = true;
    expect(store.importCsv(csv)).toBe(false);
    expect(saved).toEqual(before);
    fail = false;
    expect(store.importCsv(csv)).toBe(true);
    store.load();
    expect(saved.dayOffDates).toContain(date);
    expect(saved.items.find((item) => item.id === todo.id)).toMatchObject(todo);
    expect(store.importCsv(csv)).toBe(true);
  });
  it('creates, completes, edits, reopens and deletes TODOs without changing worklogs', () => {
    const store = TestBed.inject(WorklogStore);
    const logs = [...saved.items];
    const draft = newTodo('2026-10-26');
    expect(store.saveTodo(draft, { title: '   ' })).toBe(false);
    expect(store.saveTodo(draft, { title: ' Review ' })).toBe(true);
    expect(store.toggleTodo(draft.id)).toBe(true);
    expect(store.saveTodo(draft, { title: 'Renamed' })).toBe(true);
    store.load();
    expect(saved.items.find((item) => item.id === draft.id)).toMatchObject({
      title: 'Renamed',
      completed: true,
    });
    expect(store.toggleTodo(draft.id)).toBe(true);
    expect(saved.items.find((item) => item.id === draft.id)).toMatchObject({ completed: false });
    expect(saved.items.filter((item) => item.type !== 'TODO')).toEqual(logs);
    expect(store.remove(draft.id)).toBe(true);
    store.load();
    expect(saved.items).toEqual(logs);
  });
  it('permits TODOs on days off and preserves them when marking off', () => {
    const store = TestBed.inject(WorklogStore);
    const draft = newTodo('2026-10-26');
    expect(store.saveTodo(draft, { title: 'Reminder' })).toBe(true);
    expect(store.dayOff(draft.date, true)).toBe(true);
    expect(saved.items).toHaveLength(1);
    expect(store.toggleTodo(draft.id)).toBe(true);
    expect(store.saveTodo(newTodo(draft.date), { title: 'Another' })).toBe(true);
    store.load();
    expect(saved.items).toHaveLength(2);
  });
  it('retains TODO state on failed and stale writes', () => {
    const store = TestBed.inject(WorklogStore);
    const draft = newTodo('2026-10-26');
    expect(store.saveTodo(draft, { title: 'Reminder' })).toBe(true);
    const before = store.document();
    fail = true;
    expect(store.toggleTodo(draft.id)).toBe(false);
    expect(store.saveTodo(draft, { title: 'Pending edit' })).toBe(false);
    expect(store.remove(draft.id)).toBe(false);
    expect(store.document()).toBe(before);
    expect(store.error()).toContain('Storage full');
    fail = false;
    saved = { ...saved, revision: saved.revision + 1 };
    expect(store.toggleTodo(draft.id)).toBe(false);
    expect(store.saveTodo(draft, { title: 'Pending edit' })).toBe(false);
    expect(store.document()).toBe(before);
  });
  it('replaces all logs atomically and prevents regeneration on reload', () => {
    const store = TestBed.inject(WorklogStore);
    const item = newItem('2026-10-27', 'MEETING');
    const csv = exportCsv([item]);
    const before = saved;
    const write = vi.spyOn(repository, 'write');
    expect(store.importCsv(csv)).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(saved.processedDates).toEqual(expect.arrayContaining(before.processedDates));
    expect(saved.dayOffDates).toEqual(before.dayOffDates);
    expect(saved.generationStartDate).toEqual(before.generationStartDate);
    store.load();
    expect(store.document()?.items.some((entry) => entry.id === item.id)).toBe(true);
    expect(saved.items).toHaveLength(1);
    expect(store.importCsv(csv)).toBe(true);
    expect(saved.items).toHaveLength(1);
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('clears all records with a header-only CSV without backfilling removed dates', () => {
    const store = TestBed.inject(WorklogStore);
    expect(store.dayOff('2026-11-02', true)).toBe(true);
    expect(store.saveTodo(newTodo('2026-10-26'), { title: 'Old TODO' })).toBe(true);
    vi.setSystemTime(new Date(2026, 9, 28, 12));
    store.today.set('2026-10-28');
    expect(store.importCsv(exportCsv([]))).toBe(true);
    store.load();
    expect(saved.items).toEqual([]);
    expect(saved.dayOffDates).toEqual([]);
    vi.setSystemTime(new Date(2026, 9, 29, 12));
    store.today.set('2026-10-29');
    store.load();
    expect(saved.items).toHaveLength(2);
    expect(saved.items.every((item) => item.date === '2026-10-29')).toBe(true);
  });
  it('retains saved state on invalid CSV, failed import and stale revision', () => {
    const store = TestBed.inject(WorklogStore);
    const item = newItem('2026-10-27', 'MEETING');
    const csv = exportCsv([item]);
    const before = store.document();
    expect(store.importCsv(csv.replace('2026-10-27', '2026-02-30'))).toBe(false);
    expect(store.document()).toEqual(before);
    fail = true;
    expect(store.importCsv(csv)).toBe(false);
    expect(store.error()).toContain('Storage full');
    expect(store.document()).toEqual(before);
    fail = false;
    saved = { ...saved, revision: saved.revision + 1 };
    expect(store.importCsv(csv)).toBe(false);
    expect(store.document()).toEqual(before);
  });
  it('deletes a batch atomically and preserves the generation ledger across reload', () => {
    const store = TestBed.inject(WorklogStore);
    const before = store.document();
    const ids = saved.items.map((item) => item.id);
    const write = vi.spyOn(repository, 'write');
    expect(store.removeMany([])).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(store.removeMany([...ids, ids[0]])).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(saved.items).toEqual([]);
    expect(saved.processedDates).toEqual(before?.processedDates);
    store.load();
    expect(store.document()?.items).toEqual([]);
  });
  it('preserves every item after failed or stale batch deletion', () => {
    const store = TestBed.inject(WorklogStore);
    const before = store.document();
    const ids = saved.items.map((item) => item.id);
    fail = true;
    expect(store.removeMany(ids)).toBe(false);
    expect(store.document()).toEqual(before);
    expect(saved).toEqual(before);
    fail = false;
    saved = { ...saved, revision: saved.revision + 1 };
    expect(store.removeMany(ids)).toBe(false);
    expect(store.document()).toEqual(before);
    expect(saved.items).toEqual(before?.items);
  });
  it('saves valid drafts, preserves input and saved state on write failure', () => {
    const store = TestBed.inject(WorklogStore);
    const draft = store.draft('2026-10-26', 'WORK_ON_TASK');
    const values = {
      name: 'Pending task',
      storyId: 'APP-1',
      storyPoints: 1,
      status: 'TODO' as const,
      timeSpent: 25,
      timeLog: true,
    };
    fail = true;
    expect(store.save(draft, values)).toBe(false);
    expect(store.document()).toEqual(saved);
    expect(values.name).toBe('Pending task');
    expect(store.error()).toContain('Storage full');
    fail = false;
    expect(store.save(draft, values)).toBe(true);
    expect(store.document()?.items.find((item) => item.id === draft.id)).toMatchObject(values);
  });
  it('does not partially remove items on a failed day-off save', () => {
    const store = TestBed.inject(WorklogStore);
    const before = store.document();
    fail = true;
    expect(store.dayOff('2026-10-26', true)).toBe(false);
    expect(store.document()).toEqual(before);
  });
  it('blocks manual saves while off and preserves deletion through reconciliation', () => {
    const store = TestBed.inject(WorklogStore);
    const item = store.document()?.items[0];
    if (!item) throw new Error('Missing item');
    expect(store.remove(item.id)).toBe(true);
    store.load();
    expect(store.document()?.items.some((entry) => entry.id === item.id)).toBe(false);
    expect(store.dayOff('2026-10-26', true)).toBe(true);
    expect(
      store.save(store.draft('2026-10-26', 'MEETING'), {
        name: '',
        storyId: '',
        storyPoints: null,
        status: 'TODO',
        timeSpent: 60,
        timeLog: false,
      }),
    ).toBe(false);
  });
  it('reconciles on local date rollover', () => {
    const store = TestBed.inject(WorklogStore);
    vi.setSystemTime(new Date(2026, 9, 27, 12));
    vi.advanceTimersByTime(30_000);
    expect(store.document()?.items.filter((item) => item.date === '2026-10-27')).toHaveLength(2);
  });
  function task(date: string, storyId: string, status: Task['status'] = 'TODO'): Task {
    const item = newItem(date, 'WORK_ON_TASK');
    if (item.type !== 'WORK_ON_TASK') throw new Error('Expected task');
    return { ...item, storyId, status, name: 'Task', timeSpent: 90, timeLog: true, storyPoints: 3 };
  }
  it('syncs status across dates and preserves every other field', () => {
    const source = task('2026-10-26', 'APP-1');
    const past = task('2026-09-01', 'APP-1', 'IN_PROGRESS');
    const future = task('2026-11-01', ' APP-1 ');
    const unrelated = task('2026-10-26', 'app-1');
    saved = { ...saved, items: [...saved.items, source, past, future, unrelated] };
    const store = TestBed.inject(WorklogStore);
    const write = vi.spyOn(repository, 'write');
    expect(store.save(source, { ...source, status: 'DONE' })).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    for (const original of [past, future]) {
      expect(saved.items.find((entry) => entry.id === original.id)).toEqual({
        ...original,
        status: 'DONE',
        updatedAt: saved.items.find((entry) => entry.id === source.id)?.updatedAt,
      });
    }
    expect(saved.items.find((entry) => entry.id === unrelated.id)).toEqual(unrelated);
    store.load();
    expect(store.document()?.items.find((entry) => entry.id === past.id)).toMatchObject({
      status: 'DONE',
    });
  });
  it('does not sync blank IDs or status-unchanged edits', () => {
    const source = task('2026-10-26', '');
    const blank = task('2026-10-25', '  ');
    const linked = task('2026-10-24', 'APP-1', 'DONE');
    saved = { ...saved, items: [...saved.items, source, blank, linked] };
    const store = TestBed.inject(WorklogStore);
    expect(store.save(source, { ...source, status: 'IN_PROGRESS' })).toBe(true);
    expect(saved.items.find((entry) => entry.id === blank.id)).toEqual(blank);
    const current = saved.items.find((entry) => entry.id === source.id);
    if (!current || current.type !== 'WORK_ON_TASK') throw new Error('Missing task');
    expect(store.save(current, { ...current, storyId: 'APP-1', name: 'Renamed' })).toBe(true);
    expect(saved.items.find((entry) => entry.id === linked.id)).toEqual(linked);
  });
  it('syncs only the new story group when ID and status change together', () => {
    const source = task('2026-10-26', 'OLD');
    const oldGroup = task('2026-10-25', 'OLD');
    const newGroup = task('2026-10-24', 'NEW');
    saved = { ...saved, items: [...saved.items, source, oldGroup, newGroup] };
    const store = TestBed.inject(WorklogStore);
    expect(store.save(source, { ...source, storyId: ' NEW ', status: 'DONE' })).toBe(true);
    expect(saved.items.find((entry) => entry.id === oldGroup.id)).toEqual(oldGroup);
    expect(saved.items.find((entry) => entry.id === newGroup.id)).toMatchObject({ status: 'DONE' });
  });
  it('keeps all occurrences unchanged after failed or stale saves', () => {
    const source = task('2026-10-26', 'APP-1');
    const linked = task('2026-10-25', 'APP-1');
    saved = { ...saved, items: [...saved.items, source, linked] };
    const store = TestBed.inject(WorklogStore);
    const before = store.document();
    fail = true;
    expect(store.save(source, { ...source, status: 'DONE' })).toBe(false);
    expect(store.document()).toEqual(before);
    expect(saved).toEqual(before);
    fail = false;
    saved = { ...saved, revision: saved.revision + 1 };
    expect(store.save(source, { ...source, status: 'DONE' })).toBe(false);
    expect(store.document()).toEqual(before);
    expect(saved.items.find((entry) => entry.id === linked.id)).toEqual(linked);
  });
});
