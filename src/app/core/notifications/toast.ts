import { DestroyRef, Injectable, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ToastPopup } from '../../shared/ui/toast-popup/toast-popup';

@Injectable({ providedIn: 'root' })
export class Toast {
  private readonly overlay = inject(Overlay);
  private readonly announcer = inject(LiveAnnouncer);
  private current: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dismiss());
  }

  success(message: string): void {
    this.dismiss();
    const overlay = this.overlay.create({
      positionStrategy: this.overlay.position().global().top('20px').centerHorizontally(),
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      panelClass: 'toast-overlay',
    });
    const component = overlay.attach(new ComponentPortal(ToastPopup));
    component.setInput('message', message);
    this.current = overlay;
    // CDK exposes the live region to active modal dialogs without stealing focus.
    void this.announcer.announce(message, 'polite');
    this.timer = setTimeout(() => this.dismiss(), 4000);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.current?.dispose();
    this.current = null;
  }
}
