import { TestBed } from '@angular/core/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Toast } from './toast';

describe('Toast notifications', () => {
  const announce = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    vi.useFakeTimers();
    announce.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: LiveAnnouncer, useValue: { announce } }],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  function visibleMessage(): string {
    return TestBed.inject(OverlayContainer).getContainerElement().textContent ?? '';
  }
  it('announces success without moving focus and dismisses after four seconds', () => {
    const active = document.activeElement;
    TestBed.inject(Toast).success('Item saved.');
    TestBed.tick();
    expect(visibleMessage()).toContain('Item saved.');
    expect(announce).toHaveBeenCalledWith('Item saved.', 'polite');
    expect(document.activeElement).toBe(active);
    vi.advanceTimersByTime(4000);
    expect(visibleMessage()).not.toContain('Item saved.');
  });
  it('replaces the previous toast and restarts its dismissal timeout', () => {
    const toast = TestBed.inject(Toast);
    toast.success('Item saved.');
    vi.advanceTimersByTime(3000);
    toast.success('Item deleted.');
    TestBed.tick();
    expect(visibleMessage()).toContain('Item deleted.');
    expect(visibleMessage()).not.toContain('Item saved.');
    vi.advanceTimersByTime(1000);
    expect(visibleMessage()).toContain('Item deleted.');
    vi.advanceTimersByTime(3000);
    expect(visibleMessage()).not.toContain('Item deleted.');
  });
  it('cleans up overlays and pending timers when destroyed', () => {
    TestBed.inject(Toast).success('Item saved.');
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    TestBed.resetTestingModule();
    expect(container.isConnected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
