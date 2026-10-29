import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  hoursToStoredDuration,
  ItemValues,
  TaskStatus,
  LoggedWorkItem,
} from '../../domain/worklog';
@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemForm {
  readonly item = input.required<LoggedWorkItem>();
  readonly saved = output<ItemValues>();
  readonly autosaved = output<ItemValues>();
  readonly cancelled = output<void>();
  readonly changed = output<boolean>();
  readonly form = new FormGroup({
    timeSpent: new FormControl(0, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        (control) =>
          typeof control.value === 'number' &&
          Number.isFinite(control.value) &&
          hoursToStoredDuration(control.value) <= Number.MAX_SAFE_INTEGER
            ? null
            : { hours: true },
      ],
    }),
    timeLog: new FormControl(false, { nonNullable: true }),
    name: new FormControl('', { nonNullable: true }),
    storyId: new FormControl('', { nonNullable: true }),
    storyPoints: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    status: new FormControl<TaskStatus>('TODO', { nonNullable: true }),
  });
  constructor() {
    effect(() => {
      const item = this.item();
      this.form.controls.name.setValidators(
        item.type === 'WORK_ON_TASK' ? [Validators.required, Validators.pattern(/\S/)] : [],
      );
      this.form.reset({
        timeSpent: item.timeSpent / 60,
        timeLog: item.timeLog,
        name: item.type === 'WORK_ON_TASK' ? item.name : '',
        storyId: item.type === 'WORK_ON_TASK' ? item.storyId : '',
        storyPoints: item.type === 'WORK_ON_TASK' ? item.storyPoints : null,
        status: item.type === 'WORK_ON_TASK' ? item.status : 'TODO',
      });
      this.changed.emit(false);
    });
  }
  leaveForm(event: FocusEvent): void {
    if (!this.form.dirty) return;
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.contains(event.relatedTarget)
    )
      return;
    if (
      event.relatedTarget instanceof Element &&
      event.relatedTarget.closest('[data-skip-autosave]')
    )
      return;
    this.autoSave();
  }
  autoSave(): void {
    this.emitValues(true);
  }
  submit(): void {
    this.emitValues(false);
  }
  private emitValues(automatic: boolean): void {
    this.form.markAllAsTouched();
    if (this.form.valid) {
      const values = this.form.getRawValue();
      const output = automatic ? this.autosaved : this.saved;
      output.emit({ ...values, timeSpent: hoursToStoredDuration(values.timeSpent) });
    }
  }
}
