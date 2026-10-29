import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
export interface ConfirmData {
  title: string;
  message: string;
  action: string;
}
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmData>(DIALOG_DATA);
  readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
