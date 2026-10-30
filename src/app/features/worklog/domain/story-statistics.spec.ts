import {
  emptyColumnFilters,
  nextStatisticSort,
  parseStatisticRange,
  StatisticFilters,
  statisticRange,
  storyStatistics,
} from './story-statistics';
import { newItem, newTodo, Task, WorkItem } from './worklog';

const filters: StatisticFilters = {
  search: '',
  start: '',
  end: '',
  columns: emptyColumnFilters(),
  sort: 'hours-desc',
};
function task(id: string, overrides: Partial<Task> = {}): Task {
  const item = newItem('2026-10-30', 'WORK_ON_TASK');
  if (item.type !== 'WORK_ON_TASK') throw new Error('Expected task');
  return { ...item, id, storyId: 'ST-1', name: 'Build feature', timeSpent: 60, ...overrides };
}
describe('Story statistics', () => {
  it('normalizes IDs, sums minutes as hours and counts independent copied entries without mutating input', () => {
    const first = task('a', { storyId: ' st-1 ', timeSpent: 6.6 });
    const items = [
      first,
      task('copy', { storyId: 'St-1', timeSpent: 7.2 }),
      task('empty', { storyId: '  ', timeSpent: 0 }),
    ];
    const before = structuredClone(items);
    const groups = storyStatistics(items, filters);
    expect(groups[0]).toMatchObject({ storyId: 'ST-1', count: 2 });
    expect(groups[0].hours).toBeCloseTo(0.23);
    expect(groups[1]).toMatchObject({ storyId: '', count: 1, hours: 0 });
    expect(items).toEqual(before);
  });
  it('excludes meetings and TODOs while retaining every task status and logging state', () => {
    const items: WorkItem[] = [
      newItem('2026-10-30', 'MEETING'),
      newTodo('2026-10-30'),
      task('todo'),
      task('progress', { status: 'IN_PROGRESS', timeLog: true }),
      task('done', { status: 'DONE' }),
    ];
    expect(storyStatistics(items, filters)[0]).toMatchObject({ count: 3, hours: 3 });
  });
  it('searches normalized IDs and titles before grouping', () => {
    const items = [task('a', { name: 'API review' }), task('b', { name: 'Layout' })];
    expect(storyStatistics(items, { ...filters, search: ' api ' })[0]).toMatchObject({
      count: 1,
      hours: 1,
    });
    expect(storyStatistics(items, { ...filters, search: ' st-1 ' })[0].count).toBe(2);
    expect(storyStatistics(items, { ...filters, search: 'missing' })).toEqual([]);
  });
  it('combines inclusive dates and search before grouping without status or logged restrictions', () => {
    const items = [
      task('first', { date: '2026-10-01', status: 'DONE', timeLog: true }),
      task('last', { date: '2026-10-31', status: 'IN_PROGRESS', timeLog: true }),
      task('outside', { date: '2026-11-01', status: 'DONE', timeLog: true }),
      task('todo', { timeLog: true }),
      task('unlogged', { status: 'DONE' }),
    ];
    const result = storyStatistics(items, {
      ...filters,
      start: '2026-10-01',
      end: '2026-10-31',
      search: 'build',
    });
    expect(result[0].entries.map((entry) => entry.id)).toEqual([
      'last',
      'todo',
      'unlogged',
      'first',
    ]);
    expect(result[0]).toMatchObject({ count: 4, hours: 4 });
  });
  it('sorts groups by each supported field with deterministic ID ties and entries by date then ID', () => {
    const items = [
      task('z', { storyId: 'B' }),
      task('a', { storyId: 'B' }),
      task('old', { storyId: 'B', date: '2026-10-01', timeSpent: 0 }),
      task('c', { storyId: 'A', timeSpent: 120 }),
    ];
    const ids = (sort: StatisticFilters['sort']) =>
      storyStatistics(items, { ...filters, sort }).map((group) => group.storyId);
    expect(ids('hours-desc')).toEqual(['A', 'B']);
    expect(ids('hours-asc')).toEqual(['A', 'B']);
    expect(ids('story-asc')).toEqual(['A', 'B']);
    expect(ids('story-desc')).toEqual(['B', 'A']);
    expect(ids('count-desc')).toEqual(['B', 'A']);
    expect(ids('count-asc')).toEqual(['A', 'B']);
    expect(storyStatistics(items, filters)[1].entries.map((entry) => entry.id)).toEqual([
      'a',
      'z',
      'old',
    ]);
    expect(
      storyStatistics([task('a'), task('b', { storyId: 'B', timeSpent: 180 })], filters)[0].storyId,
    ).toBe('B');
  });
  it('handles leap years, year rollover and local inclusive month boundaries', () => {
    expect(statisticRange('current', '2024-02-15')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    });
    expect(statisticRange('previous', '2026-01-31')).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
    expect(statisticRange('previous', '2026-03-31')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
    expect(statisticRange('all')).toEqual({ start: '', end: '' });
  });
  it('applies column ranges to aggregated values and retains every contributing entry', () => {
    const items = [
      task('a', { timeSpent: 45 }),
      task('b', { timeSpent: 45 }),
      task('c', { storyId: 'OTHER', timeSpent: 120 }),
    ];
    const result = storyStatistics(items, {
      ...filters,
      columns: { story: ' st ', hours: { min: 1.5, max: 1.5 }, count: { min: 2, max: 2 } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ storyId: 'ST-1', hours: 1.5, count: 2 });
    expect(result[0].entries.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(
      storyStatistics(items, {
        ...filters,
        columns: { ...filters.columns, count: { min: 3, max: null } },
      }),
    ).toEqual([]);
    expect(
      storyStatistics(items, {
        ...filters,
        search: 'Build',
        columns: { ...filters.columns, hours: { min: null, max: 1.5 } },
      })[0].storyId,
    ).toBe('ST-1');
  });
  it('matches the displayed missing-ID label and compares unrounded hours including zero', () => {
    const items = [task('a', { storyId: '', timeSpent: 0 }), task('b', { timeSpent: 60.24 })];
    expect(
      storyStatistics(items, {
        ...filters,
        columns: { ...filters.columns, story: ' NO story ' },
      })[0].storyId,
    ).toBe('');
    expect(
      storyStatistics(items, {
        ...filters,
        columns: { ...filters.columns, hours: { min: null, max: 1 } },
      }).map((group) => group.storyId),
    ).toEqual(['']);
    expect(
      storyStatistics(items, {
        ...filters,
        columns: { ...filters.columns, hours: { min: 1.001, max: null } },
      })[0].hours,
    ).toBeCloseTo(1.004);
  });
  it('validates numeric drafts with optional bounds and integer entry counts', () => {
    expect(parseStatisticRange({ min: '', max: ' ' }, false)).toEqual({
      range: { min: null, max: null },
      error: '',
    });
    expect(parseStatisticRange({ min: '.25', max: '1.5' }, false).range).toEqual({
      min: 0.25,
      max: 1.5,
    });
    expect(parseStatisticRange({ min: '0', max: '' }, true).range).toEqual({ min: 0, max: null });
    for (const min of ['-1', 'NaN', 'Infinity', 'oops', '1e309'])
      expect(parseStatisticRange({ min, max: '' }, false).range).toBeNull();
    expect(parseStatisticRange({ min: '1.5', max: '' }, true).error).toContain('whole');
    expect(parseStatisticRange({ min: '3', max: '2' }, false).error).toContain('Maximum');
  });
  it('toggles only the chosen column and uses the approved initial directions', () => {
    expect(nextStatisticSort('hours-desc', 'hours')).toBe('hours-asc');
    expect(nextStatisticSort('hours-asc', 'hours')).toBe('hours-desc');
    expect(nextStatisticSort('hours-desc', 'story')).toBe('story-asc');
    expect(nextStatisticSort('story-asc', 'story')).toBe('story-desc');
    expect(nextStatisticSort('story-desc', 'count')).toBe('count-desc');
    expect(nextStatisticSort('count-desc', 'count')).toBe('count-asc');
  });
});
