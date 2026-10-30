import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('navigates to Statistics with Workplace active and does not generate worklogs after leaving the tracker', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    try {
      await router.navigateByUrl('/workplace/worklog');
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      const navigation = element.querySelector('app-workplace-navigation');
      expect(
        navigation?.querySelectorAll('.material-symbols-outlined[aria-hidden="true"]'),
      ).toHaveLength(2);
      setItem.mockClear();
      element.querySelector<HTMLAnchorElement>('a[href="/workplace/statistic"]')?.click();
      await fixture.whenStable();
      expect(router.url).toBe('/workplace/statistic');
      expect(element.querySelector('app-workplace-navigation')).toBe(navigation);
      expect(navigation?.querySelector('nav')?.classList.contains('statistics-active')).toBe(true);
      expect(
        navigation?.querySelector('a[href="/workplace/statistic"]')?.getAttribute('aria-current'),
      ).toBe('page');
      expect(element.querySelector('main h1')?.textContent).toContain('Story statistics');
      expect(
        element
          .querySelector('nav[aria-label="Main navigation"] a[href="/workplace/worklog"]')
          ?.getAttribute('aria-current'),
      ).toBe('page');
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it('navigates between Personal skeleton and Workplace with the active link marked', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/workplace/worklog');
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const personal = compiled.querySelector<HTMLAnchorElement>('nav a[href="/personal"]');
    expect(personal).toBeTruthy();
    expect(personal?.hasAttribute('disabled')).toBe(false);
    personal?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/personal');
    expect(personal?.getAttribute('aria-current')).toBe('page');
    expect(compiled.querySelector('main h1')?.textContent).toBe('Personal');
    expect(compiled.querySelector('main')?.textContent).toContain('coming soon');
    compiled.querySelector<HTMLAnchorElement>('nav a[href="/workplace/worklog"]')?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/workplace/worklog');
    expect(personal?.hasAttribute('aria-current')).toBe(false);
    expect(
      compiled.querySelector('nav a[href="/workplace/worklog"]')?.getAttribute('aria-current'),
    ).toBe('page');
  });
});
