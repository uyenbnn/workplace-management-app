import { LoggedWorkItem, isLoggedItem, WorkItem, WorklogDocument, validDate } from './worklog';

export const CSV_COLUMNS = [
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
export interface ImportRow {
  row: number;
  id: string;
  status: 'new' | 'identical' | 'conflicting' | 'invalid';
  message: string;
  item?: WorkItem;
}
export interface ImportPreview {
  rows: ImportRow[];
  additions: WorkItem[];
  invalid: boolean;
}
// Prefix potentially executable cells and literal apostrophes; decoding removes exactly one prefix.
function protect(value: string): string {
  return /^[\s]*[=+@-]/.test(value) || /^[\t\r\n']/.test(value) ? "'" + value : value;
}
function unprotect(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value;
}
function values(item: LoggedWorkItem): string[] {
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
  ];
}
export function exportCsv(items: readonly WorkItem[], month?: string): string {
  const rows = [...items]
    .filter(isLoggedItem)
    .filter((item) => !month || item.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map(values);
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
export function previewCsv(
  text: string,
  document: WorklogDocument,
  now = new Date().toISOString(),
): ImportPreview {
  const [header, ...data] = parseCsv(text);
  if (!header || header.join(',') !== CSV_COLUMNS.join(','))
    throw new Error(
      'Unsupported CSV headers. Use a worklog CSV export. timeSpent is stored in minutes.',
    );
  const ids = new Map<string, number>();
  data.forEach((row) => {
    const id = unprotect(row[0] ?? '');
    ids.set(id, (ids.get(id) ?? 0) + 1);
  });
  const existing = new Map(document.items.map((item) => [item.id, item]));
  const rows: ImportRow[] = data.map((raw, index) => {
    const cells = raw.map(unprotect);
    const [id, date, type, duration, logged, storyId, name, points, status] = cells;
    const invalid = (message: string): ImportRow => ({
      row: index + 2,
      id: id ?? '',
      status: 'invalid',
      message,
    });
    if (cells.length !== CSV_COLUMNS.length) return invalid('Wrong column count.');
    if (!id.trim() || id !== id.trim() || /[\x00-\x1f]/.test(id))
      return invalid(
        'A nonempty stable ID without surrounding whitespace or control characters is required.',
      );
    if ((ids.get(id) ?? 0) > 1) return invalid('Duplicate ID in this file.');
    if (!validDate(date)) return invalid('Invalid local date; use YYYY-MM-DD.');
    if (document.dayOffDates.includes(date))
      return invalid('Date is marked off. Remove this row or change the day-off setting first.');
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
    const previous = existing.get(id);
    if (previous) {
      const identical =
        previous.type !== 'TODO' &&
        JSON.stringify(values(previous)) === JSON.stringify(values(item));
      return {
        row: index + 2,
        id,
        status: identical ? 'identical' : 'conflicting',
        message: identical
          ? 'Already saved; skipped.'
          : 'Saved entry differs; keeping existing entry.',
      };
    }
    return { row: index + 2, id, status: 'new', message: 'Ready to import.', item };
  });
  return {
    rows,
    additions: rows.flatMap((row) => (row.item ? [row.item] : [])),
    invalid: rows.some((row) => row.status === 'invalid'),
  };
}
