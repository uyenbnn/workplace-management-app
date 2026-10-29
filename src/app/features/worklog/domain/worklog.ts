export type ItemType = 'MEETING' | 'WORK_ON_TASK' | 'TODO';
export type LoggedItemType = Exclude<ItemType, 'TODO'>;
export interface Todo {
  type: 'TODO';
  id: string;
  date: string;
  title: string;
  completed: boolean;
  source: 'MANUAL';
  defaultSlot: null;
  createdAt: string;
  updatedAt: string;
}
export interface TodoValues {
  title: string;
}
export function newTodo(date: string): Todo {
  const now = new Date().toISOString();
  return {
    type: 'TODO',
    id: crypto.randomUUID(),
    date,
    title: '',
    completed: false,
    source: 'MANUAL',
    defaultSlot: null,
    createdAt: now,
    updatedAt: now,
  };
}
export function isLoggedItem(item: WorkItem): item is LoggedWorkItem {
  return item.type !== 'TODO';
}
export function todoProgress(items: readonly WorkItem[]): string {
  const todos = items.filter((item): item is Todo => item.type === 'TODO');
  return todos.length
    ? `TODO ${todos.filter((item) => item.completed).length}/${todos.length} done`
    : '';
}
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
// Keep the existing storage unit so older worklogs retain their durations.
export function hoursToStoredDuration(hours: number): number {
  return Number((hours * 60).toPrecision(15));
}
export function formatHours(storedDuration: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(storedDuration / 60);
}
interface ItemBase {
  id: string;
  date: string;
  timeSpent: number;
  timeLog: boolean;
  source: 'AUTO' | 'MANUAL';
  defaultSlot: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Meeting extends ItemBase {
  type: 'MEETING';
}
export interface Task extends ItemBase {
  type: 'WORK_ON_TASK';
  storyId: string;
  name: string;
  storyPoints: number | null;
  status: TaskStatus;
}
export type LoggedWorkItem = Meeting | Task;
export type WorkItem = LoggedWorkItem | Todo;
export interface WorklogDocument {
  schemaVersion: 1;
  revision: number;
  generationStartDate: string;
  processedDates: string[];
  dayOffDates: string[];
  items: WorkItem[];
}
export interface ItemValues {
  timeSpent: number;
  timeLog: boolean;
  storyId: string;
  name: string;
  storyPoints: number | null;
  status: TaskStatus;
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear().toString().padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(0);
  value.setFullYear(year, month - 1, day);
  value.setHours(12, 0, 0, 0);
  return value;
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDate(parseDate(value)) === value
  );
}
export function shiftDate(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function weekday(value: string): boolean {
  return ![0, 6].includes(parseDate(value).getDay());
}
export function monthDays(month: string): string[] {
  const first = month.slice(0, 7) + '-01';
  const offset = (parseDate(first).getDay() + 6) % 7;
  const last = parseDate(first);
  last.setMonth(last.getMonth() + 1, 0);
  const count = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => shiftDate(first, index - offset));
}
export function itemTitle(item: WorkItem): string {
  return item.type === 'TODO'
    ? item.title
    : item.type === 'MEETING'
      ? 'Meeting'
      : item.name || 'Untitled task';
}
export function orderedItems(items: WorkItem[]): WorkItem[] {
  const rank = (item: WorkItem) => (item.source === 'MANUAL' ? 2 : item.type === 'MEETING' ? 0 : 1);
  return [...items].sort(
    (a, b) =>
      rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
export function newItem(
  date: string,
  type: LoggedItemType,
  source: 'AUTO' | 'MANUAL' = 'MANUAL',
): LoggedWorkItem {
  const base: ItemBase = {
    id: crypto.randomUUID(),
    date,
    source,
    defaultSlot: source === 'AUTO' ? `${date}:${type}` : null,
    timeSpent: type === 'MEETING' ? 60 : 0,
    timeLog: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return type === 'MEETING'
    ? { ...base, type }
    : { ...base, type, storyId: '', name: '', storyPoints: null, status: 'TODO' };
}
export function emptyDocument(today: string): WorklogDocument {
  return {
    schemaVersion: 1,
    revision: 0,
    generationStartDate: today,
    processedDates: [],
    dayOffDates: [],
    items: [],
  };
}
export function reconcile(document: WorklogDocument, today: string): WorklogDocument {
  let items = [...document.items];
  const processed = new Set(document.processedDates);
  const off = new Set(document.dayOffDates);
  for (let date = document.generationStartDate; date <= today; date = shiftDate(date, 1)) {
    if (!weekday(date) || off.has(date) || processed.has(date)) continue;
    const source = items
      .filter(
        (item): item is Task =>
          item.type === 'WORK_ON_TASK' &&
          item.date < date &&
          weekday(item.date) &&
          !off.has(item.date),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          Number(b.source === 'AUTO') - Number(a.source === 'AUTO') ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      )[0];
    const task = newItem(date, 'WORK_ON_TASK', 'AUTO');
    if (task.type === 'WORK_ON_TASK' && source)
      Object.assign(task, {
        storyId: source.storyId,
        name: source.name,
        storyPoints: source.storyPoints,
        status: source.status,
      });
    items = [...items, newItem(date, 'MEETING', 'AUTO'), task];
    processed.add(date);
  }
  return { ...document, items, processedDates: [...processed].sort() };
}
export function setDayOff(
  document: WorklogDocument,
  date: string,
  off: boolean,
  today: string,
): WorklogDocument {
  if (off)
    return {
      ...document,
      dayOffDates: [...new Set([...document.dayOffDates, date])],
      items: document.items.filter((item) => item.date !== date || item.type === 'TODO'),
    };
  return reconcile(
    {
      ...document,
      dayOffDates: document.dayOffDates.filter((day) => day !== date),
      processedDates: document.processedDates.filter((day) => day !== date),
    },
    today,
  );
}
export function validateValues(type: LoggedItemType, values: ItemValues): void {
  if (
    !Number.isFinite(values.timeSpent) ||
    values.timeSpent < 0 ||
    values.timeSpent > Number.MAX_SAFE_INTEGER
  )
    throw new Error('Enter a finite, nonnegative duration in hours.');
  if (
    type === 'WORK_ON_TASK' &&
    (!values.name.trim() ||
      (values.storyPoints !== null &&
        (!Number.isFinite(values.storyPoints) || values.storyPoints < 0)))
  )
    throw new Error('Enter a task name and nonnegative story points.');
  if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(values.status))
    throw new Error('Choose a valid status.');
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function timestamp(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function validItem(value: unknown): value is WorkItem {
  if (record(value) && value['type'] === 'TODO') {
    return (
      typeof value['id'] === 'string' &&
      value['id'].trim() !== '' &&
      validDate(value['date']) &&
      typeof value['title'] === 'string' &&
      value['title'].trim() !== '' &&
      (value['note'] === undefined || typeof value['note'] === 'string') &&
      typeof value['completed'] === 'boolean' &&
      value['source'] === 'MANUAL' &&
      value['defaultSlot'] === null &&
      timestamp(value['createdAt']) &&
      timestamp(value['updatedAt']) &&
      !['timeSpent', 'timeLog', 'storyId', 'name', 'storyPoints', 'status'].some(
        (key) => key in value,
      )
    );
  }
  if (
    !record(value) ||
    typeof value['id'] !== 'string' ||
    !value['id'] ||
    !validDate(value['date']) ||
    typeof value['timeSpent'] !== 'number' ||
    !Number.isFinite(value['timeSpent']) ||
    Number(value['timeSpent']) > Number.MAX_SAFE_INTEGER ||
    Number(value['timeSpent']) < 0 ||
    typeof value['timeLog'] !== 'boolean' ||
    !timestamp(value['createdAt']) ||
    !timestamp(value['updatedAt'])
  )
    return false;
  if (value['type'] !== 'MEETING' && value['type'] !== 'WORK_ON_TASK') return false;
  if (value['source'] !== 'AUTO' && value['source'] !== 'MANUAL') return false;
  if (
    value['defaultSlot'] !==
    (value['source'] === 'AUTO' ? `${value['date']}:${value['type']}` : null)
  )
    return false;
  return (
    value['type'] === 'MEETING' ||
    (typeof value['name'] === 'string' &&
      typeof value['storyId'] === 'string' &&
      (value['storyPoints'] === null ||
        (typeof value['storyPoints'] === 'number' &&
          Number.isFinite(value['storyPoints']) &&
          value['storyPoints'] >= 0)) &&
      ['TODO', 'IN_PROGRESS', 'DONE'].includes(String(value['status'])))
  );
}
export function decodeDocument(raw: string): WorklogDocument {
  const value: unknown = JSON.parse(raw);
  const dates = (entry: unknown): entry is string[] =>
    Array.isArray(entry) && entry.every(validDate) && new Set(entry).size === entry.length;
  if (
    !record(value) ||
    value['schemaVersion'] !== 1 ||
    !Number.isSafeInteger(value['revision']) ||
    Number(value['revision']) < 0 ||
    !validDate(value['generationStartDate']) ||
    !dates(value['processedDates']) ||
    !Array.isArray(value['items']) ||
    !value['items'].every(validItem)
  )
    throw new Error(
      'Stored worklog is damaged or uses an unsupported version. Original data has been preserved.',
    );
  const off = value['dayOffDates'] === undefined ? [] : value['dayOffDates'];
  if (!dates(off)) throw new Error('Invalid days off. Original data has been preserved.');
  // Legacy TODO notes are intentionally dropped; current reminders are title-only.
  const items: WorkItem[] = value['items'].map((item): WorkItem =>
    item.type === 'TODO'
      ? {
          type: 'TODO',
          id: item.id,
          date: item.date,
          title: item.title,
          completed: item.completed,
          source: 'MANUAL',
          defaultSlot: null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }
      : item,
  );
  const processedDates = value['processedDates'];
  const slots = items.flatMap((item) => (item.defaultSlot ? [item.defaultSlot] : []));
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    new Set(slots).size !== slots.length ||
    items.some(
      (item) =>
        (item.type !== 'TODO' && off.includes(item.date)) ||
        (item.source === 'AUTO' && (!weekday(item.date) || !processedDates.includes(item.date))),
    )
  )
    throw new Error('Stored worklog has conflicting entries. Original data has been preserved.');
  return {
    schemaVersion: 1,
    revision: Number(value['revision']),
    generationStartDate: value['generationStartDate'],
    processedDates: value['processedDates'],
    dayOffDates: off,
    items,
  };
}

export function workWeekDays(anchor: string): string[] {
  const offset = (parseDate(anchor).getDay() + 6) % 7;
  return Array.from({ length: 5 }, (_, index) => shiftDate(anchor, index - offset));
}
export function workWeekLabel(anchor: string): string {
  const dates = workWeekDays(anchor);
  const format = (date: string) =>
    parseDate(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${format(dates[0])} \u2013 ${format(dates[4])}`;
}
