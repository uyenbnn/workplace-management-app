import { TestBed } from '@angular/core/testing';
import { DayCell } from './day-cell';
import { newItem, newTodo } from '../../domain/worklog';
describe('TODO calendar pills', () => {
  it('shows reminder titles and completion in both views and on days off without showing TODO worklog cards', async () => {
    const fixture = TestBed.createComponent(DayCell);
    fixture.componentRef.setInput('date', '2026-10-26');
    fixture.componentRef.setInput('items', [
      newItem('2026-10-26', 'MEETING'),
      { ...newTodo('2026-10-26'), title: 'Review', completed: true },
      { ...newTodo('2026-10-26'), title: 'Prepare notes' },
      { ...newTodo('2026-10-26'), title: 'Follow up' },
    ]);
    const open = vi.fn();
    fixture.componentInstance.openTodos.subscribe(open);
    for (const layout of ['month', 'work-week']) {
      fixture.componentRef.setInput('layout', layout);
      await fixture.whenStable();
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.todo-pill');
      expect(button.textContent).toContain('Review');
      expect(button.textContent).toContain('Done');
      expect(button.classList.contains('completed')).toBe(true);
      const pills: NodeListOf<HTMLButtonElement> =
        fixture.nativeElement.querySelectorAll('.todo-pill');
      expect(pills).toHaveLength(3);
      expect(pills[1].textContent).toContain('Prepare notes');
      expect(pills[1].textContent).toContain('To do');
      expect(pills[2].textContent).toContain('Follow up');
      expect(fixture.nativeElement.querySelectorAll('app-work-item-card')).toHaveLength(1);
      button.click();
      expect(open).toHaveBeenCalled();
    }
    fixture.componentRef.setInput('off', true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.todo-pill')).not.toBeNull();
    fixture.componentRef.setInput('items', []);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.todo-pill')).toBeNull();
  });
});
