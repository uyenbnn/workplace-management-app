import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { WORKLOG_REPOSITORY, WorklogRepository } from './worklog-repository';
import { WorklogStore } from './worklog-store';
import { emptyDocument, localDate, reconcile, WorklogDocument } from '../domain/worklog';
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Not initialized');
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('Asynchronous cloud state', () => {
  let saved: WorklogDocument;
  let repository: WorklogRepository;
  beforeEach(() => {
    saved = reconcile(emptyDocument(localDate()), localDate());
    repository = {
      read: async () => saved,
      write: async (document, revision) => {
        if (revision !== saved.revision) throw new Error('Stale revision');
        saved = { ...document, revision: saved.revision + 1 };
        return saved;
      },
    };
    TestBed.configureTestingModule({
      providers: [{ provide: WORKLOG_REPOSITORY, useValue: repository }],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('keeps saved state unchanged until confirmation and serializes writes with current revisions', async () => {
    const store = TestBed.inject(WorklogStore);
    await store.load();
    const gate = deferred<WorklogDocument>();
    const firstWrite = vi.spyOn(repository, 'write').mockImplementationOnce(async (document) => {
      await gate.promise;
      saved = { ...document, revision: saved.revision + 1 };
      return saved;
    });
    const before = store.document();
    const first = store.dayOff('2030-01-01', true);
    const second = store.dayOff('2030-01-02', true);
    await Promise.resolve();
    expect(firstWrite).toHaveBeenCalledTimes(1);
    expect(store.document()).toBe(before);
    expect(store.pending()).toBe(true);
    gate.resolve(saved);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(saved.dayOffDates).toEqual(['2030-01-01', '2030-01-02']);
    expect(store.pending()).toBe(false);
  });
  it('rejects stale retries until the user reloads the saved revision', async () => {
    const store = TestBed.inject(WorklogStore);
    await store.load();
    const before = store.document();
    saved = { ...saved, revision: saved.revision + 1 };
    expect(await store.dayOff('2030-01-01', true)).toBe(false);
    expect(store.document()).toBe(before);
    expect(await store.dayOff('2030-01-01', true)).toBe(false);
    await store.load();
    expect(await store.dayOff('2030-01-01', true)).toBe(true);
  });
  it('ignores an older delayed refresh after a newer refresh', async () => {
    const store = TestBed.inject(WorklogStore);
    await store.load();
    const gate = deferred<WorklogDocument>();
    vi.spyOn(repository, 'read').mockReturnValueOnce(gate.promise);
    const slow = store.load();
    saved = { ...saved, revision: 8 };
    await store.load();
    gate.resolve({ ...saved, revision: 2 });
    await slow;
    expect(store.document()?.revision).toBe(8);
  });
  it('does not publish a previous account response into the new session', async () => {
    localStorage.clear();
    const identity = signal<string | null>('owner');
    Object.assign(repository, { identity });
    const store = TestBed.inject(WorklogStore);
    TestBed.tick();
    await store.load();
    const gate = deferred<WorklogDocument>();
    vi.spyOn(repository, 'read').mockReturnValueOnce(gate.promise);
    const old = store.load();
    identity.set(null);
    TestBed.tick();
    gate.resolve(saved);
    await old;
    expect(store.document()).toBeNull();
    expect(await store.dayOff('2030-01-01', true)).toBe(false);
  });
  it('starts fresh cloud persistence without reading or modifying legacy worklog data', async () => {
    const original = '{old damaged browser document';
    localStorage.setItem('worktask.worklog.v1', original);
    const identity = signal<string | null>('owner');
    let cloud: WorklogDocument | null = null;
    Object.assign(repository, {
      identity,
      read: async () => cloud,
      write: async (document: WorklogDocument) => {
        cloud = { ...document, revision: 1 };
        return cloud;
      },
    });
    const readLocal = vi.spyOn(Storage.prototype, 'getItem');
    const store = TestBed.inject(WorklogStore);
    TestBed.tick();
    await store.load();
    expect(store.importEnabled).toBe(false);
    expect(store.migration.pending()).toBe(false);
    expect(store.document()?.generationStartDate).toBe(localDate());
    expect(store.document()?.revision).toBe(1);
    expect(readLocal.mock.calls.some(([key]) => key === 'worktask.worklog.v1')).toBe(false);
    readLocal.mockRestore();
    expect(localStorage.getItem('worktask.worklog.v1')).toBe(original);
    localStorage.removeItem('worktask.worklog.v1');
  });
});
