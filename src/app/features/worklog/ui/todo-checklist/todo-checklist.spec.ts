import { TestBed } from '@angular/core/testing';
import { TodoChecklist } from './todo-checklist';
import { newTodo } from '../../domain/worklog';
describe('Inline TODO checklist', () => {
  it('ignores Enter during composition and held-key repeats', () => {
    const fixture = TestBed.createComponent(TodoChecklist);
    const item = { ...newTodo('2026-10-26'), title: 'First' };
    fixture.componentRef.setInput('items', [item]);
    const create = vi.fn();
    fixture.componentInstance.createAfter.subscribe(create);
    fixture.componentInstance.enterTitle(new KeyboardEvent('keydown', { isComposing: true }), item);
    fixture.componentInstance.enterTitle(new KeyboardEvent('keydown', { repeat: true }), item);
    expect(create).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { cancelable: true });
    fixture.componentInstance.enterTitle(enter, item);
    expect(enter.defaultPrevented).toBe(true);
    expect(create).toHaveBeenCalledWith(item);
  });
  it('edits only titles inline and saves on leaving the row', async () => {
    const fixture = TestBed.createComponent(TodoChecklist);
    const item = { ...newTodo('2026-10-26'), title: 'First' };
    fixture.componentRef.setInput('items', [item]);
    await fixture.whenStable();
    const edited = vi.fn(),
      saved = vi.fn();
    fixture.componentInstance.edited.subscribe(edited);
    fixture.componentInstance.saved.subscribe(saved);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('textarea')).toBeNull();
    const title = element.querySelector<HTMLInputElement>('.title');
    if (!title) throw new Error('Missing title');
    title.value = 'Updated';
    title.dispatchEvent(new Event('input'));
    expect(edited).toHaveBeenCalledWith({ item, values: { title: 'Updated' } });
    title.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: element.querySelector('.delete'),
      }),
    );
    expect(saved).not.toHaveBeenCalled();
    title.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: element.querySelector('.add-todo'),
      }),
    );
    expect(saved).toHaveBeenCalledWith(item);
  });
  it('shows leading checkboxes, trailing accessible delete icons, completion and inline errors', async () => {
    const fixture = TestBed.createComponent(TodoChecklist);
    const first = { ...newTodo('2026-10-26'), title: 'First', completed: true };
    const second = { ...newTodo('2026-10-26'), title: 'Second' };
    fixture.componentRef.setInput('items', [first, second]);
    fixture.componentRef.setInput('errors', { [second.id]: 'Enter a TODO title.' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const rows = element.querySelectorAll('.todo-row');
    expect(rows[0].firstElementChild?.getAttribute('type')).toBe('checkbox');
    expect(rows[0].lastElementChild?.getAttribute('aria-label')).toBe('Delete TODO: First');
    expect(rows[0].querySelector<HTMLInputElement>('.title')?.value).toBe('First');
    expect(rows[0].querySelector('.done')).not.toBeNull();
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Enter a TODO title.');
    expect(rows[1].querySelector('.title')?.getAttribute('aria-invalid')).toBe('true');
    const remove = vi.fn();
    fixture.componentInstance.remove.subscribe(remove);
    rows[0].querySelector<HTMLButtonElement>('.delete')?.click();
    expect(remove).toHaveBeenCalledWith(first);
  });
});
