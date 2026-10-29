import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { Todo, TodoValues } from '../../domain/worklog';
export interface TodoEdit {
  item: Todo;
  values: TodoValues;
}
@Component({
  selector: 'app-todo-checklist',
  templateUrl: './todo-checklist.html',
  styleUrl: './todo-checklist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoChecklist {
  readonly items = input.required<Todo[]>();
  readonly errors = input<Readonly<Record<string, string>>>({});
  readonly add = output<void>();
  readonly createAfter = output<Todo>();
  readonly focusId = input<string>();
  private readonly titles = viewChildren<ElementRef<HTMLInputElement>>('titleInput');
  private focusedId: string | undefined;
  constructor() {
    afterRenderEffect(() => {
      const id = this.focusId();
      const title = this.titles().find((entry) => entry.nativeElement.dataset['todoId'] === id);
      if (id && title && this.focusedId !== id) {
        this.focusedId = id;
        title.nativeElement.focus();
      }
    });
  }
  enterTitle(event: Event, item: Todo): void {
    if (!(event instanceof KeyboardEvent) || event.isComposing || event.repeat) return;
    event.preventDefault();
    this.createAfter.emit(item);
  }
  readonly edited = output<TodoEdit>();
  readonly remove = output<Todo>();
  readonly toggle = output<string>();
  readonly saved = output<Todo>();
  leaveRow(event: FocusEvent, item: Todo): void {
    if (
      event.currentTarget instanceof HTMLElement &&
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    )
      return;
    this.saved.emit(item);
  }
}
