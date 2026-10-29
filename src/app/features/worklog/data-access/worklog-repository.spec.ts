import { emptyDocument, newTodo, reconcile } from '../domain/worklog';
import { LocalStorageWorklogRepository, STORAGE_KEY } from './worklog-repository';
describe('Local storage repository', () => {
  const repo = new LocalStorageWorklogRepository();
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it('loads legacy worklogs and persists reminders without replacing them', () => {
    const legacy = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const reminder = {
      ...newTodo('2026-10-26'),
      title: 'Review',
      completed: true,
    };
    const saved = repo.write({ ...legacy, items: [...legacy.items, reminder] }, legacy.revision);
    expect(repo.read()).toEqual(saved);
    expect(repo.read()?.items.slice(0, 2)).toEqual(legacy.items);
    const corrupt = JSON.stringify({ ...saved, items: [{ ...reminder, completed: 'yes' }] });
    localStorage.setItem(STORAGE_KEY, corrupt);
    expect(() => repo.read()).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(corrupt);
  });
  it('migrates legacy TODO notes without losing titles, completion, IDs or worklogs', () => {
    const worklog = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    const todo = { ...newTodo('2026-10-26'), title: 'Keep this title', completed: true };
    const legacy = {
      ...worklog,
      items: [...worklog.items, { ...todo, note: 'Removed legacy note' }],
    };
    const raw = JSON.stringify(legacy);
    localStorage.setItem(STORAGE_KEY, raw);
    const loaded = repo.read();
    expect(loaded?.items).toEqual([...worklog.items, todo]);
    expect(loaded?.items[2]).not.toHaveProperty('note');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    // Serialization also strips legacy fields supplied by an older caller.
    const saved = repo.write(legacy, legacy.revision);
    expect(saved.items).toEqual([...worklog.items, todo]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').items[2]).not.toHaveProperty(
      'note',
    );
    expect(repo.read()).toEqual(saved);
  });
  it('round-trips data and rejects stale revisions', () => {
    const saved = repo.write(reconcile(emptyDocument('2026-10-26'), '2026-10-26'), null);
    expect(saved.revision).toBe(1);
    expect(repo.read()).toEqual(saved);
    expect(() => repo.write(saved, 0)).toThrow(/another tab/);
    expect(repo.read()).toEqual(saved);
  });
  it('preserves malformed storage instead of replacing it', () => {
    localStorage.setItem(STORAGE_KEY, 'broken');
    expect(() => repo.read()).toThrow();
    expect(() => repo.write(emptyDocument('2026-10-26'), null)).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('broken');
  });
  it('reports failed writes and preserves the previous saved document', () => {
    const saved = repo.write(emptyDocument('2026-10-26'), null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(() => repo.write({ ...saved, dayOffDates: ['2026-10-27'] }, saved.revision)).toThrow(
      /Could not save/,
    );
    expect(repo.read()).toEqual(saved);
  });
});
