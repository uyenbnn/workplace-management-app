import { workWeekDays, workWeekLabel } from './worklog';
describe('Work-week dates', () => {
  it('uses the preceding work week for weekends', () => {
    expect(workWeekDays('2026-10-31')).toEqual(workWeekDays('2026-11-01'));
    expect(workWeekDays('2026-11-01')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
    ]);
  });
  it('crosses year boundaries and includes leap days', () => {
    expect(workWeekDays('2025-01-01')).toEqual([
      '2024-12-30',
      '2024-12-31',
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
    ]);
    expect(workWeekDays('2024-02-29')).toContain('2024-02-29');
    expect(workWeekLabel('2025-01-01')).toContain('2024');
    expect(workWeekLabel('2025-01-01')).toContain('2025');
  });
});
