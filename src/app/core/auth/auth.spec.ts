import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Auth, authGuard, safeReturnUrl } from './auth';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
describe('Account route protection', () => {
  const user = signal<{ id: string } | null>(null);
  beforeEach(() => {
    user.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { user, recovery: signal(false), ready: Promise.resolve() } },
      ],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('redirects signed-out visitors and preserves the requested Workplace route', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(new ActivatedRouteSnapshot(), {
        url: '/workplace/statistic',
      } as RouterStateSnapshot),
    );
    expect(
      TestBed.inject(Router).serializeUrl(
        typeof result === 'object' && result !== null && 'root' in result
          ? result
          : TestBed.inject(Router).createUrlTree(['/unexpected']),
      ),
    ).toBe('/auth?returnUrl=%2Fworkplace%2Fstatistic');
    user.set({ id: 'owner' });
    expect(
      await TestBed.runInInjectionContext(() =>
        authGuard(new ActivatedRouteSnapshot(), {
          url: '/workplace/statistic',
        } as RouterStateSnapshot),
      ),
    ).toBe(true);
  });
  it('accepts only local Workplace return paths', () => {
    for (const value of ['https://example.com', '//example.com', '/\\example.com', '/auth', null])
      expect(safeReturnUrl(value)).toBe('/workplace/worklog');
    expect(safeReturnUrl('/workplace/statistic')).toBe('/workplace/statistic');
  });
});
