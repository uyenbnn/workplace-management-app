import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LocalWorklogMigration } from './local-worklog-migration';
import { STORAGE_KEY, WorklogRepository } from './worklog-repository';
import {
  decodeDocument,
  emptyDocument,
  newTodo,
  reconcile,
  WorklogDocument,
} from '../domain/worklog';
describe('Full local worklog migration', () => {
  let local: WorklogDocument;
  let cloud: WorklogDocument | null;
  let migration: LocalWorklogMigration;
  let repository: WorklogRepository;
  const identity = signal<string | null>('owner');
  beforeEach(() => {
    localStorage.clear();
    identity.set('owner');
    local = reconcile(emptyDocument('2026-10-26'), '2026-10-28');
    local.items = [
      ...local.items.slice(1),
      { ...newTodo('2026-10-28'), title: 'Review', completed: true },
    ];
    cloud = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    TestBed.configureTestingModule({});
    migration = TestBed.inject(LocalWorklogMigration);
    repository = {
      identity,
      read: async () => cloud,
      write: async (document) => {
        cloud = { ...document, revision: 1 };
        return cloud;
      },
    };
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });
  it('preserves TODOs, deletion history and metadata, verifies readback, and remembers the account', async () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(await migration.inspect('owner', null)).toBe(true);
    expect(await migration.transfer(repository, 'owner')).toBe(true);
    expect(cloud).toEqual({ ...local, revision: 1 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    migration = new LocalWorklogMigration();
    expect(await migration.inspect('owner', cloud)).toBe(false);
    expect(await migration.inspect('other-owner', cloud)).toBe(true);
  });
  it('does not overwrite corrupt local data or a different cloud document', async () => {
    localStorage.setItem(STORAGE_KEY, '{bad JSON');
    expect(await migration.inspect('owner', null)).toBe(true);
    expect(migration.error()).not.toBe('');
    expect(await migration.transfer(repository, 'owner')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{bad JSON');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    cloud = emptyDocument('2026-11-04');
    await migration.inspect('owner', cloud);
    const write = vi.spyOn(repository, 'write');
    expect(await migration.transfer(repository, 'owner')).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
  it('retries a committed request with a lost response, including JSONB key order changes', async () => {
    await migration.inspect('owner', null);
    repository.write = async (document) => {
      cloud = decodeDocument(
        JSON.stringify({
          ...document,
          items: document.items.map((item) => Object.fromEntries(Object.entries(item).reverse())),
        }),
      );
      throw new Error('Connection lost');
    };
    expect(await migration.transfer(repository, 'owner')).toBe(false);
    expect(migration.pending()).toBe(true);
    expect(await migration.transfer(repository, 'owner')).toBe(true);
    expect(migration.pending()).toBe(false);
  });
  it('does not acknowledge a transfer after the account changes', async () => {
    await migration.inspect('owner', null);
    repository.read = async () => {
      identity.set('other');
      return null;
    };
    expect(await migration.transfer(repository, 'owner')).toBe(false);
    expect(localStorage.getItem('worktask.worklog.migrated.owner')).toBeNull();
  });
});
