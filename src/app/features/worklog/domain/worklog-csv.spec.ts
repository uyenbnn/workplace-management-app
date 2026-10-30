import { emptyDocument, newItem, newTodo, reconcile } from './worklog';
import { CSV_COLUMNS, exportCsv, parseCsv, previewCsv } from './worklog-csv';
describe('CSV worklog transfers', () => {
  const task = (name = 'Task') => ({
    ...newItem('2026-10-26', 'WORK_ON_TASK'),
    type: 'WORK_ON_TASK' as const,
    storyId: 'APP-1',
    name,
    storyPoints: 1.5,
    status: 'DONE' as const,
    timeSpent: 12.75,
    timeLog: true,
  });
  it('round trips Unicode, commas, quotes, multiline text and executable prefixes', () => {
    for (const name of [
      'Tiếng Việt, "quoted"\nnext line',
      '=SUM(A1)',
      ' +1',
      '-2',
      '@cmd',
      "'literal",
      "''double",
      '\ttext',
    ]) {
      const item = task(name);
      const csv = exportCsv([item]);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      const importedAt = '2026-10-28T12:00:00.000Z';
      const preview = previewCsv(csv, importedAt);
      expect(preview.invalid).toBe(false);
      expect(preview.additions[0]).toMatchObject({
        ...item,
        createdAt: importedAt,
        updatedAt: importedAt,
      });
    }
  });
  it('sorts by date then ID and filters current month', () => {
    const a = { ...task(), id: 'a' };
    const b = { ...task(), id: 'b' };
    const other = { ...task(), date: '2026-11-01' };
    expect(
      parseCsv(exportCsv([other, b, a], '2026-10'))
        .slice(1)
        .map((row) => row[0]),
    ).toEqual(['a', 'b']);
    expect(parseCsv(exportCsv([other, b, a]))).toHaveLength(4);
    expect(parseCsv(exportCsv([]))).toEqual([[...CSV_COLUMNS]]);
  });
  it('uses CSV values even when saved IDs match or differ', () => {
    const item = task();
    const document = { ...emptyDocument(item.date), items: [item] };
    expect(previewCsv(exportCsv([item])).count).toBe(1);
    const preview = previewCsv(exportCsv([{ ...item, name: 'Changed' }]));
    expect(preview.additions[0]).toMatchObject({ id: item.id, name: 'Changed' });
  });
  it('transfers generated placeholders as manual entries without generation metadata', () => {
    const document = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    const preview = previewCsv(exportCsv(document.items));
    expect(preview.invalid).toBe(false);
    expect(
      preview.additions.every((item) => item.source === 'MANUAL' && item.defaultSlot === null),
    ).toBe(true);
  });
  it('rejects duplicate IDs but ignores saved day-off flags', () => {
    const item = task();
    expect(previewCsv(exportCsv([item, item])).rows.every((row) => row.status === 'invalid')).toBe(
      true,
    );
    expect(previewCsv(exportCsv([item])).invalid).toBe(false);
  });
  it('rejects invalid fields and blocks the entire preview', () => {
    const item = task();
    const csv = exportCsv([item]);
    for (const [before, after] of [
      ['2026-10-26', '2026-02-30'],
      ['WORK_ON_TASK', 'OTHER'],
      ['DONE', 'WAIT'],
      ['12.75', 'NaN'],
      ['true', 'yes'],
      [item.id, ''],
    ]) {
      expect(previewCsv(csv.replace(before, after)).invalid).toBe(true);
    }
  });
  it('rejects unsupported headers and malformed quotes', () => {
    expect(() => previewCsv('id,date\na,b')).toThrow('headers');
    expect(() => parseCsv('"unfinished')).toThrow('Unclosed');
    expect(() => parseCsv('"a"tail')).toThrow('Malformed');
  });
});

describe('CSV TODO and day-off transfers', () => {
  const date = '2026-11-02';
  const todo = { ...newTodo(date), title: '=Review, "notes"\nnext', completed: true };
  it('round trips days off and completed TODOs together, idempotently', () => {
    const csv = exportCsv([todo], undefined, [date]);
    const preview = previewCsv(csv, todo.createdAt);
    expect(preview.invalid).toBe(false);
    expect(preview.count).toBe(2);
    expect(preview.dayOffAdditions).toEqual([date]);
    expect(preview.additions[0]).toMatchObject(todo);
    const again = previewCsv(csv);
    expect(again.count).toBe(2);
    expect(again.rows.every((row) => row.status === 'new')).toBe(true);
  });
  it('filters day-off dates by month and imports a day-off-only file', () => {
    const preview = previewCsv(exportCsv([], '2026-11', [date, '2026-12-01']));
    expect(preview.count).toBe(1);
    expect(preview.dayOffAdditions).toEqual([date]);
  });
  it('replaces saved worklogs with days off and rejects contradictory CSV records', () => {
    const meeting = newItem(date, 'MEETING');
    const csv = exportCsv([], undefined, [date]);
    expect(previewCsv(csv).rows[0].status).toBe('new');
    const combined = previewCsv(exportCsv([meeting, todo], undefined, [date]));
    expect(combined.invalid).toBe(true);
    expect(combined.dayOffAdditions).toEqual([date]);
    expect(combined.additions).toHaveLength(1);
  });
  it('validates TODO fields and duplicate day-off dates', () => {
    const csv = exportCsv([todo]);
    expect(previewCsv(csv.replace('true', 'yes')).invalid).toBe(true);
    expect(previewCsv(exportCsv([{ ...todo, title: ' ' }])).invalid).toBe(true);
    expect(previewCsv(exportCsv([], undefined, [date, date])).invalid).toBe(true);
  });
  it('accepts older nine-column exports', () => {
    const csv =
      'id,date,type,timeSpent,timeLog,storyId,name,storyPoints,status\r\nold,2026-11-02,MEETING,60,false,,,,\r\n';
    expect(previewCsv(csv).additions).toHaveLength(1);
  });
});
