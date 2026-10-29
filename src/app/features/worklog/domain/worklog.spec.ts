import {
  decodeDocument,
  emptyDocument,
  localDate,
  monthDays,
  newItem,
  reconcile,
  setDayOff,
  shiftDate,
  validateValues,
} from './worklog';
describe('Worklog domain', () => {
  it('handles leap days, year boundaries and Monday-first months', () => {
    expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDate('2024-12-31', 1)).toBe('2025-01-01');
    expect(monthDays('2026-02-01')[0]).toBe('2026-01-26');
    expect(monthDays('2026-02-01')).toHaveLength(35);
    expect(localDate(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
  it('starts only today and skips first-use weekends', () => {
    expect(reconcile(emptyDocument('2026-10-24'), '2026-10-25').items).toEqual([]);
    expect(reconcile(emptyDocument('2026-10-26'), '2026-10-26').items).toHaveLength(2);
  });
  it('backfills chronologically, skips weekends and days off, and never duplicates', () => {
    const doc = reconcile(
      { ...emptyDocument('2026-10-22'), dayOffDates: ['2026-10-23'] },
      '2026-10-27',
    );
    expect(doc.items.map((item) => item.date)).toEqual([
      '2026-10-22',
      '2026-10-22',
      '2026-10-26',
      '2026-10-26',
      '2026-10-27',
      '2026-10-27',
    ]);
    expect(reconcile(doc, '2026-10-27')).toEqual(doc);
  });
  it('preserves deleted default slots and existing edits', () => {
    const doc = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    doc.items = doc.items
      .filter((item) => item.type === 'MEETING')
      .map((item) => ({ ...item, timeSpent: 30, timeLog: true }));
    expect(reconcile(doc, '2026-10-26').items).toEqual(doc.items);
  });
  it('prefers default tasks, carries DONE across weekends and resets tracking independently', () => {
    const doc = reconcile(emptyDocument('2026-10-23'), '2026-10-23');
    const source = doc.items.find((item) => item.type === 'WORK_ON_TASK');
    if (!source || source.type !== 'WORK_ON_TASK') throw new Error('Missing task');
    Object.assign(source, {
      name: 'Ship MVP',
      storyId: 'APP-1',
      storyPoints: 2.5,
      status: 'DONE',
      timeSpent: 90,
      timeLog: true,
    });
    const manual = newItem('2026-10-23', 'WORK_ON_TASK');
    if (manual.type === 'WORK_ON_TASK') manual.name = 'Other task';
    doc.items.push(manual);
    const next = reconcile(doc, '2026-10-27');
    const copies = next.items.filter(
      (item) => item.type === 'WORK_ON_TASK' && item.date > '2026-10-23',
    );
    expect(copies).toHaveLength(2);
    expect(copies[0]).toMatchObject({
      name: 'Ship MVP',
      storyId: 'APP-1',
      storyPoints: 2.5,
      status: 'DONE',
      timeSpent: 0,
      timeLog: false,
    });
    expect(copies[0]?.id).not.toBe(source.id);
    source.name = 'Changed';
    expect(copies[0]).toMatchObject({ name: 'Ship MVP' });
  });
  it('falls back to earliest manual task when the default was deleted', () => {
    const first = newItem('2026-10-23', 'WORK_ON_TASK');
    const second = newItem('2026-10-23', 'WORK_ON_TASK');
    if (first.type === 'WORK_ON_TASK') first.name = 'First';
    first.createdAt = '2026-10-23T01:00:00.000Z';
    second.createdAt = '2026-10-23T02:00:00.000Z';
    const doc = reconcile({ ...emptyDocument('2026-10-26'), items: [second, first] }, '2026-10-26');
    expect(
      doc.items.find((item) => item.date === '2026-10-26' && item.type === 'WORK_ON_TASK'),
    ).toMatchObject({ name: 'First' });
  });
  it('removes all entries on days off and makes one fresh pair when unmarked', () => {
    const doc = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    const off = setDayOff(doc, '2026-10-26', true, '2026-10-26');
    expect(off.items).toEqual([]);
    expect(reconcile(off, '2026-10-26').items).toEqual([]);
    const restored = setDayOff(off, '2026-10-26', false, '2026-10-26');
    expect(restored.items).toHaveLength(2);
    expect(restored.items[0]?.id).not.toBe(doc.items[0]?.id);
    expect(reconcile(restored, '2026-10-26')).toEqual(restored);
    expect(
      setDayOff({ ...off, dayOffDates: ['2026-10-31'] }, '2026-10-31', false, '2026-10-26').items,
    ).toEqual([]);
  });
  it('rejects invalid values while allowing zero minutes and fractional points', () => {
    const values = {
      name: 'Task',
      storyId: '',
      storyPoints: 0.5,
      status: 'TODO' as const,
      timeSpent: 0,
      timeLog: false,
    };
    expect(() => validateValues('WORK_ON_TASK', values)).not.toThrow();
    for (const timeSpent of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => validateValues('MEETING', { ...values, timeSpent })).toThrow();
    expect(() => validateValues('WORK_ON_TASK', { ...values, name: '  ' })).toThrow();
    expect(() => validateValues('WORK_ON_TASK', { ...values, storyPoints: -1 })).toThrow();
  });
  it('validates schemas and migrates missing dayOffDates without changing entries', () => {
    const doc = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    expect(decodeDocument(JSON.stringify(doc))).toEqual(doc);
    const { dayOffDates, ...older } = doc;
    expect(decodeDocument(JSON.stringify(older)).dayOffDates).toEqual(dayOffDates);
    for (const raw of [
      '{bad',
      JSON.stringify({ ...doc, schemaVersion: 99 }),
      JSON.stringify({ ...doc, items: [...doc.items, ...doc.items] }),
      JSON.stringify({ ...doc, generationStartDate: '2026-02-30' }),
    ])
      expect(() => decodeDocument(raw)).toThrow();
  });
});
