import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { StatisticPage } from '../../pages/statistic-page/statistic-page';
import { WORKLOG_REPOSITORY } from '../../data-access/worklog-repository';
import { emptyDocument, localDate, newItem, Task } from '../../domain/worklog';

function task(id: string, storyId: string, minutes: number): Task {
  const item = newItem(localDate(), 'WORK_ON_TASK');
  if (item.type !== 'WORK_ON_TASK') throw new Error('Expected task');
  return { ...item, id, storyId, name: 'Task ' + id, timeSpent: minutes };
}
describe('Story statistics table interactions', () => {
  let fixture: ComponentFixture<StatisticPage>;
  let element: HTMLElement;
  const write = vi.fn();
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [StatisticPage],
      providers: [
        {
          provide: WORKLOG_REPOSITORY,
          useValue: {
            read: () => ({
              ...emptyDocument(localDate()),
              items: [
                task('a', 'A', 60),
                task('b', 'B', 120),
                task('copy', 'B', 120),
                task('empty', '', 0),
              ],
            }),
            write,
          },
        },
      ],
    });
    // jsdom has no layout; native focusability is verified independently of geometry here.
    const checker = TestBed.inject(InteractivityChecker);
    vi.spyOn(checker, 'isFocusable').mockReturnValue(true);
    vi.spyOn(checker, 'isTabbable').mockReturnValue(true);
    write.mockReset();
    fixture = TestBed.createComponent(StatisticPage);
    element = fixture.nativeElement;
    document.body.appendChild(element);
    await fixture.whenStable();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    element.remove();
    vi.restoreAllMocks();
  });
  function button(label: string): HTMLButtonElement {
    const result = element.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]');
    if (!result) throw new Error('Missing button: ' + label);
    return result;
  }
  async function open(label: string): Promise<HTMLElement> {
    const trigger = button('Filter ' + label);
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('Missing filter dialog');
    return dialog;
  }
  async function edit(dialog: HTMLElement, index: number, value: string): Promise<void> {
    const input = dialog.querySelectorAll<HTMLInputElement>('input')[index];
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  }
  it('sorts from column labels, exposes aria-sort and preserves expanded groups', async () => {
    const page = fixture.componentInstance;
    page.toggle('B');
    expect(element.querySelectorAll('thead th')[1].getAttribute('aria-sort')).toBe('descending');
    button('Sort by Story ID').click();
    await fixture.whenStable();
    expect(page.sort()).toBe('story-asc');
    expect(element.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(element.querySelectorAll('thead th')[1].getAttribute('aria-sort')).toBe('none');
    button('Sort by Story ID').click();
    button('Sort by Entries').click();
    await fixture.whenStable();
    expect(page.sort()).toBe('count-desc');
    expect(element.querySelector('tbody th')?.textContent).toContain('B');
    expect(page.expanded().has('B')).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it('applies story text immediately, keeps controls on no matches, and clears its indicator', async () => {
    const dialog = await open('Story ID');
    expect(document.activeElement).toBe(dialog.querySelector('input'));
    await edit(dialog, 0, 'missing');
    expect(fixture.componentInstance.groups()).toEqual([]);
    expect(element.textContent).toContain('No matching tasks');
    expect(element.querySelectorAll('thead button')).toHaveLength(6);
    expect(button('Filter Story ID (active)').classList.contains('is-filtered')).toBe(true);
    await edit(dialog, 0, ' no story ');
    expect(fixture.componentInstance.groups()[0].storyId).toBe('');
    dialog.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.groups()).toHaveLength(3);
    expect(button('Filter Story ID').classList.contains('is-filtered')).toBe(false);
  });
  it('retains invalid numeric drafts and last valid results, then clears both', async () => {
    const dialog = await open('Hours');
    await edit(dialog, 0, '4');
    expect(fixture.componentInstance.summary()).toEqual({ hours: 4, entries: 2 });
    await edit(dialog, 1, '2');
    expect(dialog.textContent).toContain('Maximum must be at least the minimum');
    expect(dialog.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.componentInstance.summary()).toEqual({ hours: 4, entries: 2 });
    dialog.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.summary()).toEqual({ hours: 5, entries: 4 });
    expect(dialog.querySelector('input')?.getAttribute('aria-invalid')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
  it('closes on Escape, restores trigger focus and preserves applied filters', async () => {
    const dialog = await open('Entries');
    await edit(dialog, 0, '2');
    dialog
      .querySelector('input')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(button('Filter Entries (active)'));
    expect(fixture.componentInstance.summary().entries).toBe(2);
    expect(button('Filter Entries (active)').getAttribute('aria-expanded')).toBe('false');
  });
  it('shows only one popover and closes when clicking outside', async () => {
    await open('Story ID');
    button('Filter Hours').click();
    await fixture.whenStable();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Filter Hours',
    );
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
