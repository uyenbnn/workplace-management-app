import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-toast-popup',
  styleUrl: './toast-popup.scss',
  templateUrl: './toast-popup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastPopup {
  readonly message = input.required<string>();
}
