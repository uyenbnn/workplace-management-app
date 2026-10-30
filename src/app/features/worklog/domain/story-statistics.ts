import { localDate, parseDate, Task, WorkItem } from './worklog';

export type StatisticPeriod = 'current' | 'previous' | 'all' | 'custom';
export type StatisticColumn = 'story' | 'hours' | 'count';
export type StatisticSort =
  'hours-desc' | 'hours-asc' | 'story-asc' | 'story-desc' | 'count-desc' | 'count-asc';
export interface StatisticRange {
  min: number | null;
  max: number | null;
}
export interface StatisticRangeDraft {
  min: string;
  max: string;
}
export interface StatisticColumnFilters {
  story: string;
  hours: StatisticRange;
  count: StatisticRange;
}
export interface StatisticColumnDrafts {
  story: string;
  hours: StatisticRangeDraft;
  count: StatisticRangeDraft;
}
export interface StatisticFilters {
  search: string;
  start: string;
  end: string;
  columns: StatisticColumnFilters;
  sort: StatisticSort;
}
export interface StoryStatistic {
  storyId: string;
  hours: number;
  count: number;
  entries: readonly Task[];
}
export function emptyColumnFilters(): StatisticColumnFilters {
  return { story: '', hours: { min: null, max: null }, count: { min: null, max: null } };
}
export function emptyColumnDrafts(): StatisticColumnDrafts {
  return { story: '', hours: { min: '', max: '' }, count: { min: '', max: '' } };
}
export function parseStatisticRange(
  draft: StatisticRangeDraft,
  integer: boolean,
): { range: StatisticRange; error: '' } | { range: null; error: string } {
  const parse = (value: string) => (value.trim() === '' ? null : Number(value.trim()));
  const range = { min: parse(draft.min), max: parse(draft.max) };
  for (const bound of ['min', 'max'] as const) {
    const text = draft[bound].trim();
    const value = range[bound];
    if (
      value !== null &&
      (!/^\d*\.?\d+$|^\d+\.$/.test(text) ||
        !Number.isFinite(value) ||
        value < 0 ||
        (integer && !Number.isInteger(value)))
    ) {
      return {
        range: null,
        error: integer
          ? 'Enter nonnegative whole numbers for entries.'
          : 'Enter nonnegative numbers for hours.',
      };
    }
  }
  if (range.min !== null && range.max !== null && range.min > range.max) {
    return { range: null, error: 'Maximum must be at least the minimum.' };
  }
  return { range, error: '' };
}
export function nextStatisticSort(current: StatisticSort, column: StatisticColumn): StatisticSort {
  switch (column) {
    case 'story':
      return current === 'story-asc' ? 'story-desc' : 'story-asc';
    case 'hours':
      return current === 'hours-desc' ? 'hours-asc' : 'hours-desc';
    case 'count':
      return current === 'count-desc' ? 'count-asc' : 'count-desc';
  }
}
export function statisticRange(
  period: Exclude<StatisticPeriod, 'custom'>,
  today = localDate(),
): { start: string; end: string } {
  if (period === 'all') return { start: '', end: '' };
  const first = parseDate(today.slice(0, 7) + '-01');
  if (period === 'previous') first.setMonth(first.getMonth() - 1);
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1, 0);
  return { start: localDate(first), end: localDate(last) };
}
export function defaultStatisticFilters(): StatisticFilters {
  return {
    ...statisticRange('current'),
    search: '',
    columns: emptyColumnFilters(),
    sort: 'hours-desc',
  };
}
export function storyStatistics(
  items: readonly WorkItem[],
  filters: StatisticFilters,
): StoryStatistic[] {
  const search = filters.search.trim().toUpperCase();
  const groups = new Map<string, Task[]>();
  for (const item of items) {
    if (item.type !== 'WORK_ON_TASK') continue;
    const storyId = item.storyId.trim().toUpperCase();
    if (
      (filters.start && item.date < filters.start) ||
      (filters.end && item.date > filters.end) ||
      (search && !storyId.includes(search) && !item.name.toUpperCase().includes(search))
    )
      continue;
    const entries = groups.get(storyId) ?? [];
    entries.push(item);
    groups.set(storyId, entries);
  }
  const inRange = (value: number, range: StatisticRange) =>
    (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
  const storyFilter = filters.columns.story.trim().toUpperCase();
  return [...groups]
    .map(([storyId, entries]) => ({
      storyId,
      hours: entries.reduce((sum, item) => sum + (item.timeSpent ?? 0), 0) / 60,
      count: entries.length,
      entries: entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    }))
    .filter(
      (group) =>
        (group.storyId || 'No story ID').toUpperCase().includes(storyFilter) &&
        inRange(group.hours, filters.columns.hours) &&
        inRange(group.count, filters.columns.count),
    )
    .sort((a, b) => {
      const tie = a.storyId.localeCompare(b.storyId);
      switch (filters.sort) {
        case 'story-asc':
          return tie;
        case 'story-desc':
          return -tie;
        case 'hours-asc':
          return a.hours - b.hours || tie;
        case 'hours-desc':
          return b.hours - a.hours || tie;
        case 'count-asc':
          return a.count - b.count || tie;
        case 'count-desc':
          return b.count - a.count || tie;
      }
    });
}
