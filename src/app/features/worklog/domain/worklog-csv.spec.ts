import { emptyDocument, newItem, reconcile } from './worklog';
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
      const preview = previewCsv(csv, emptyDocument('2026-10-26'), importedAt);
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
  it('skips identical records and keeps conflicting saved values', () => {
    const item = task();
    const document = { ...emptyDocument(item.date), items: [item] };
    expect(previewCsv(exportCsv([item]), document).rows[0].status).toBe('identical');
    const preview = previewCsv(exportCsv([{ ...item, name: 'Changed' }]), document);
    expect(preview.rows[0].status).toBe('conflicting');
    expect(preview.additions).toEqual([]);
  });
  it('transfers generated placeholders as manual entries without generation metadata', () => {
    const document = reconcile(emptyDocument('2026-10-26'), '2026-10-26');
    const preview = previewCsv(exportCsv(document.items), emptyDocument('2026-10-27'));
    expect(preview.invalid).toBe(false);
    expect(
      preview.additions.every((item) => item.source === 'MANUAL' && item.defaultSlot === null),
    ).toBe(true);
  });
  it('rejects duplicate IDs and dates marked off', () => {
    const item = task();
    expect(
      previewCsv(exportCsv([item, item]), emptyDocument(item.date)).rows.every(
        (row) => row.status === 'invalid',
      ),
    ).toBe(true);
    expect(
      previewCsv(exportCsv([item]), { ...emptyDocument(item.date), dayOffDates: [item.date] })
        .invalid,
    ).toBe(true);
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
      expect(previewCsv(csv.replace(before, after), emptyDocument(item.date)).invalid).toBe(true);
    }
  });
  it('rejects unsupported headers and malformed quotes', () => {
    expect(() => previewCsv('id,date\na,b', emptyDocument('2026-10-26'))).toThrow('headers');
    expect(() => parseCsv('"unfinished')).toThrow('Unclosed');
    expect(() => parseCsv('"a"tail')).toThrow('Malformed');
  });
});
