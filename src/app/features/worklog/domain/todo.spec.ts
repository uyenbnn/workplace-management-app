import {
  decodeDocument,
  emptyDocument,
  isLoggedItem,
  newTodo,
  reconcile,
  setDayOff,
  todoProgress,
} from './worklog';
import { exportCsv, previewCsv } from './worklog-csv';
describe('Daily TODO domain and compatibility', () => {
  const todo = () => ({ ...newTodo('2026-10-26'), title: 'Review notes' });
  it('loads old documents unchanged and round trips TODOs including days off', () => {
    const old = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    expect(decodeDocument(JSON.stringify(old))).toEqual(old);
    const document = { ...old, items: [...old.items, todo()] };
    const off = setDayOff(document, '2026-10-26', true, '2026-10-26');
    expect(off.items).toEqual([document.items[2]]);
    expect(decodeDocument(JSON.stringify(off))).toEqual(off);
    const restored = setDayOff(off, '2026-10-26', false, '2026-10-26');
    expect(restored.items.filter(isLoggedItem)).toHaveLength(2);
    expect(restored.items.filter((item) => item.type === 'TODO')).toEqual(off.items);
  });
  it.each([
    { title: '  ' },
    { completed: 'yes' },
    { note: null },
    { timeLog: false },
    { timeSpent: 0 },
    { status: 'DONE' },
    { source: 'AUTO' },
  ])('rejects malformed reminder fields %j', (fields) => {
    const document = { ...emptyDocument('2026-10-26'), items: [{ ...todo(), ...fields }] };
    expect(() => decodeDocument(JSON.stringify(document))).toThrow(/preserved/);
  });
  it('never copies or rolls reminders forward and transfers them through CSV', () => {
    const item = todo();
    const document = reconcile({ ...emptyDocument('2026-10-26'), items: [item] }, '2026-10-28');
    expect(document.items.filter((entry) => entry.type === 'TODO')).toEqual([item]);
    const tasks = document.items.filter((entry) => entry.type === 'WORK_ON_TASK');
    expect(tasks).toHaveLength(3);
    expect(tasks.every((task) => task.name === '')).toBe(true);
    const preview = previewCsv(exportCsv(document.items));
    expect(preview.additions).toHaveLength(7);
    expect(preview.invalid).toBe(false);
  });
  it('summarizes empty, unchecked, mixed, and completed reminders', () => {
    const a = todo(),
      b = { ...todo(), completed: true };
    expect(todoProgress([])).toBe('');
    expect(todoProgress([a])).toBe('TODO 0/1 done');
    expect(todoProgress([a, b])).toBe('TODO 1/2 done');
    expect(todoProgress([{ ...a, completed: true }, b])).toBe('TODO 2/2 done');
  });
});
