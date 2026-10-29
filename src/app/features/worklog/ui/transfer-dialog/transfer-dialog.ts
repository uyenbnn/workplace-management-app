import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { WorklogStore } from '../../data-access/worklog-store';
import { exportCsv, previewCsv } from '../../domain/worklog-csv';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
@Component({
  selector: 'app-transfer-dialog',
  imports: [],
  templateUrl: './transfer-dialog.html',
  styleUrl: './transfer-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferDialog {
  readonly store = inject(WorklogStore);
  readonly ref = inject<DialogRef<void>>(DialogRef);
  readonly data = inject<{ month: string }>(DIALOG_DATA);
  private readonly dialogs = inject(Dialog);
  readonly scope = signal('month');
  readonly text = signal<string | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly reading = signal(false);
  private confirming = false;
  private readVersion = 0;
  readonly preview = computed(() => {
    const text = this.text();
    const document = this.store.document();
    if (text === null || !document) return null;
    try {
      return { result: previewCsv(text, document), error: '' };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : 'Cannot parse CSV.' };
    }
  });
  readonly counts = computed(() => {
    const rows = this.preview()?.result?.rows ?? [];
    return {
      new: rows.filter((row) => row.status === 'new').length,
      identical: rows.filter((row) => row.status === 'identical').length,
      conflicting: rows.filter((row) => row.status === 'conflicting').length,
      invalid: rows.filter((row) => row.status === 'invalid').length,
    };
  });
  constructor() {
    const keys = this.ref.keydownEvents.subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void this.close();
      }
    });
    const backdrop = this.ref.backdropClick.subscribe(() => void this.close());
    this.ref.closed.subscribe(() => {
      this.readVersion++;
      keys.unsubscribe();
      backdrop.unsubscribe();
    });
  }
  async selectFile(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (!file) return;
    const version = ++this.readVersion;
    this.reading.set(true);
    this.text.set(null);
    this.error.set('');
    this.notice.set('');
    try {
      const text = await file.text();
      if (version === this.readVersion) this.text.set(text);
    } catch {
      if (version === this.readVersion)
        this.error.set('Could not read the selected file. Please retry.');
    } finally {
      if (version === this.readVersion) this.reading.set(false);
      input.value = '';
    }
  }
  download(): void {
    const document = this.store.document();
    if (!document) return;
    this.error.set('');
    try {
      const month = this.scope() === 'month' ? this.data.month : undefined;
      const url = URL.createObjectURL(
        new Blob([exportCsv(document.items, month)], { type: 'text/csv;charset=utf-8' }),
      );
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `worklogs-${month ?? 'all'}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.error.set('CSV download could not be started. Please retry.');
    }
  }
  import(): void {
    const text = this.text();
    const preview = this.preview()?.result;
    if (text === null || !preview || preview.invalid || !preview.additions.length) return;
    const count = preview.additions.length;
    if (this.store.importCsv(text)) {
      this.text.set(null);
      this.error.set('');
      this.notice.set(`${count} entries imported.`);
    } else this.error.set(this.store.error());
  }
  async close(): Promise<void> {
    if (this.confirming) return;
    if (this.text() !== null || this.reading()) {
      this.confirming = true;
      try {
        const discard = await firstValueFrom(
          this.dialogs.open<boolean>(ConfirmDialog, {
            data: {
              title: 'Discard import preview?',
              message: 'The selected CSV has not been imported. You can select it again later.',
              action: 'Discard preview',
            },
            ariaLabelledBy: 'confirm-title',
            width: 'min(440px, calc(100vw - 32px))',
          }).closed,
        );
        if (!discard) return;
      } finally {
        this.confirming = false;
      }
    }
    this.ref.close();
  }
}
