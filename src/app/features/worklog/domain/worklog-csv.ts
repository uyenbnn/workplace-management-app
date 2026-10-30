import { WorkItem, validDate } from './worklog';

const LEGACY_COLUMNS = [
  'id',
  'date',
  'type',
  'timeSpent',
  'timeLog',
  'storyId',
  'name',
  'storyPoints',
  'status',
] as const;
export const CSV_COLUMNS = [...LEGACY_COLUMNS, 'title', 'completed'] as const;
export interface ImportRow {
  row: number;
  id: string;
  status: 'new' | 'invalid';
  message: string;
  item?: WorkItem;
  dayOffDate?: string;
}
export interface ImportPreview {
  rows: ImportRow[];
  additions: WorkItem[];
  invalid: boolean;
  dayOffAdditions: string[];
  count: number;
}
// Prefix potentially executable cells and literal apostrophes; decoding removes exactly one prefix.
function protect(value: string): string {
  return /^[\s]*[=+@-]/.test(value) || /^[\t\r\n']/.test(value) ? "'" + value : value;
}
function unprotect(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value;
}
function values(item: WorkItem): string[] {
  if (item.type === 'TODO')
    return [
      item.id,
      item.date,
      item.type,
      '',
      '',
      '',
      '',
      '',
      '',
      item.title,
      String(item.completed),
    ];
  return [
    item.id,
    item.date,
    item.type,
    String(item.timeSpent),
    String(item.timeLog),
    item.type === 'WORK_ON_TASK' ? item.storyId : '',
    item.type === 'WORK_ON_TASK' ? item.name : '',
    item.type === 'WORK_ON_TASK' && item.storyPoints !== null ? String(item.storyPoints) : '',
    item.type === 'WORK_ON_TASK' ? item.status : '',
    '',
    '',
  ];
}
export function exportCsv(
  items: readonly WorkItem[],
  month?: string,
  dayOffDates: readonly string[] = [],
): string {
  const rows = [...items]
    .filter((item) => !month || item.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map(values);
  rows.push(
    ...dayOffDates
      .filter((date) => !month || date.startsWith(month))
      .map((date) => ['', date, 'DAY_OFF', '', '', '', '', '', '', '', '']),
  );
  rows.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  return (
    '\uFEFF' +
    [CSV_COLUMNS, ...rows]
      .map((row) => row.map((value) => '"' + protect(value).replaceAll('"', '""') + '"').join(','))
      .join('\r\n') +
    '\r\n'
  );
}
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let ended = false;
  const push = () => {
    row.push(field);
    field = '';
    ended = false;
  };
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          ended = true;
        }
      } else field += ch;
    } else if (ch === ',') push();
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[index + 1] === '\n') index++;
      push();
      rows.push(row);
      row = [];
    } else if (ch === '"' && field === '' && !ended) quoted = true;
    else {
      if (ended || ch === '"') throw new Error('Malformed CSV quoting.');
      field += ch;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quoted field.');
  if (field !== '' || row.length || ended) {
    push();
    rows.push(row);
  }
  return rows;
}
export function previewCsv(text: string, now = new Date().toISOString()): ImportPreview {
  const [header, ...data] = parseCsv(text);
  const legacy = header?.join(',') === LEGACY_COLUMNS.join(',');
  if (!header || (!legacy && header.join(',') !== CSV_COLUMNS.join(',')))
    throw new Error(
      'Unsupported CSV headers. Use a worklog CSV export. timeSpent is stored in minutes.',
    );
  const ids = new Map<string, number>();
  data.forEach((row) => {
    const id = unprotect(row[0] ?? '');
    ids.set(id, (ids.get(id) ?? 0) + 1);
  });
  const dayCounts = new Map<string, number>();
  data.forEach((raw) => {
    if (unprotect(raw[2] ?? '') === 'DAY_OFF') {
      const date = unprotect(raw[1] ?? '');
      dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
    }
  });

  const rows: ImportRow[] = data.map((raw, index) => {
    const cells = raw.map(unprotect);
    const [id, date, type, duration, logged, storyId, name, points, status] = cells;
    const title = cells[9] ?? '';
    const completed = cells[10] ?? '';
    const invalid = (message: string): ImportRow => ({
      row: index + 2,
      id: id ?? '',
      status: 'invalid',
      message,
    });
    if (cells.length !== (legacy ? LEGACY_COLUMNS.length : CSV_COLUMNS.length))
      return invalid('Wrong column count.');
    if (!validDate(date)) return invalid('Invalid local date; use YYYY-MM-DD.');
    if (type === 'DAY_OFF') {
      if (id || cells.slice(3).some(Boolean))
        return invalid('Day-off rows require only date and type DAY_OFF.');
      if ((dayCounts.get(date) ?? 0) > 1) return invalid('Duplicate day-off date in this file.');
      return {
        row: index + 2,
        id: date,
        status: 'new',
        message: 'Ready to import day off.',
        dayOffDate: date,
      };
    }
    if (!id.trim() || id !== id.trim() || /[\x00-\x1f]/.test(id))
      return invalid(
        'A nonempty stable ID without surrounding whitespace or control characters is required.',
      );
    if ((ids.get(id) ?? 0) > 1) return invalid('Duplicate ID in this file.');
    if (!validDate(date)) return invalid('Invalid local date; use YYYY-MM-DD.');
    if (type !== 'TODO' && dayCounts.has(date))
      return invalid('CSV contains both worklogs and a day-off flag for this date.');
    if (type === 'TODO') {
      if (cells.slice(3, 9).some(Boolean)) return invalid('TODO worklog fields must be empty.');
      if (!title.trim()) return invalid('Enter a TODO title.');
      if (completed !== 'true' && completed !== 'false')
        return invalid('completed must be true or false.');
      const item: WorkItem = {
        id,
        date,
        type,
        title,
        completed: completed === 'true',
        source: 'MANUAL',
        defaultSlot: null,
        createdAt: now,
        updatedAt: now,
      };
      return { row: index + 2, id, status: 'new', message: 'Ready to import TODO.', item };
    }
    if (title || completed) return invalid('Worklog TODO fields must be empty.');
    if (type !== 'MEETING' && type !== 'WORK_ON_TASK') return invalid('Invalid item type.');
    const numeric = (value: string) =>
      /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value));
    if (!numeric(duration) || Number(duration) > Number.MAX_SAFE_INTEGER)
      return invalid('timeSpent must be a finite nonnegative number of minutes.');
    if (logged !== 'true' && logged !== 'false') return invalid('timeLog must be true or false.');
    const base = {
      id,
      date,
      type,
      timeSpent: Number(duration),
      timeLog: logged === 'true',
      source: 'MANUAL' as const,
      defaultSlot: null,
      createdAt: now,
      updatedAt: now,
    };
    let item: WorkItem;
    if (type === 'MEETING') {
      if (storyId || name || points || status) return invalid('Meeting task fields must be empty.');
      item = { ...base, type };
    } else {
      if (status !== 'TODO' && status !== 'IN_PROGRESS' && status !== 'DONE')
        return invalid('Invalid task status.');
      if (points !== '' && !numeric(points))
        return invalid('Story points must be empty or finite and nonnegative.');
      // Empty names are valid saved generated placeholders and must survive a transfer.
      item = {
        ...base,
        type,
        storyId,
        name,
        storyPoints: points === '' ? null : Number(points),
        status,
      };
    }
    return { row: index + 2, id, status: 'new', message: 'Ready to import.', item };
  });
  return {
    rows,
    dayOffAdditions: rows.flatMap((row) => (row.dayOffDate ? [row.dayOffDate] : [])),
    count: rows.filter((row) => row.status === 'new').length,
    additions: rows.flatMap((row) => (row.item ? [row.item] : [])),
    invalid: rows.some((row) => row.status === 'invalid'),
  };
}
