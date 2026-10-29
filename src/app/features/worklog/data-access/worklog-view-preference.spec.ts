import { vi } from 'vitest';
import { VIEW_STORAGE_KEY, WorklogViewPreference } from './worklog-view-preference';
describe('Worklog view preference', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  it('defaults invalid or missing values to Month and restores Work week', () => {
    const preference = new WorklogViewPreference();
    expect(preference.read()).toBe('month');
    localStorage.setItem(VIEW_STORAGE_KEY, 'invalid');
    expect(preference.read()).toBe('month');
    expect(preference.write('work-week')).toBe(true);
    expect(preference.read()).toBe('work-week');
  });
  it('tolerates storage read and write failures', () => {
    const preference = new WorklogViewPreference();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(preference.read()).toBe('month');
    expect(preference.write('work-week')).toBe(false);
  });
});
