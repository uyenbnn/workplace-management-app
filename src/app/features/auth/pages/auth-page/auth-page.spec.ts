import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthPage } from './auth-page';
import { Auth } from '../../../../core/auth/auth';
import { Supabase } from '../../../../core/supabase/supabase';
describe('Authentication forms', () => {
  const signIn = vi.fn();
  const recovery = signal(false);
  beforeEach(() => {
    signIn.mockReset();
    recovery.set(false);
    TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { recovery } },
        { provide: Supabase, useValue: { client: { auth: { signInWithPassword: signIn } } } },
      ],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('validates credentials and retains input on failure without duplicate requests', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    await page.submit();
    expect(signIn).not.toHaveBeenCalled();
    page.form.setValue({ email: 'me@example.com', password: 'eight-characters' });
    let finish: (result: { error: Error }) => void = () => {
      throw new Error('Not initialized');
    };
    signIn.mockReturnValue(
      new Promise<{ error: Error }>((resolve) => {
        finish = resolve;
      }),
    );
    const request = page.submit();
    await page.submit();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(page.pending()).toBe(true);
    finish({ error: new Error('Network unavailable') });
    await request;
    expect(page.pending()).toBe(false);
    expect(page.error()).toBe('Network unavailable');
    expect(page.form.getRawValue()).toEqual({
      email: 'me@example.com',
      password: 'eight-characters',
    });
  });
  it('renders app-styled controls with labels and selected account mode', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#auth-title')?.textContent).toBe('Welcome back.');
    expect(element.querySelector('label[for="auth-email"]')).not.toBeNull();
    expect(element.querySelector('label[for="auth-password"]')).not.toBeNull();
    expect(element.querySelector('button.primary[type="submit"]')?.textContent).toContain(
      'Sign in',
    );
    const switcher = element.querySelector('[aria-label="Account action"]');
    expect(switcher?.querySelector('[aria-pressed="true"]')?.textContent).toContain('Sign in');
    fixture.componentInstance.setMode('signup');
    await fixture.whenStable();
    expect(element.querySelector('#auth-title')?.textContent).toBe('Make it yours.');
    expect(switcher?.querySelector('[aria-pressed="true"]')?.textContent).toContain(
      'Create account',
    );
  });
  it('supports recovery navigation and password visibility without clearing entered values', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.form.setValue({ email: 'me@example.com', password: 'my-password' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('[aria-label="Show password"]')?.click();
    await fixture.whenStable();
    expect(element.querySelector<HTMLInputElement>('#auth-password')?.type).toBe('text');
    element.querySelector<HTMLButtonElement>('.label-row .text-button')?.click();
    await fixture.whenStable();
    expect(page.mode()).toBe('reset');
    expect(element.querySelector('#auth-password')).toBeNull();
    expect(element.querySelector('#auth-title')?.textContent).toBe('Forgot your password?');
    element.querySelector<HTMLButtonElement>('.back-button')?.click();
    await fixture.whenStable();
    expect(page.mode()).toBe('signin');
    expect(page.form.controls.email.value).toBe('me@example.com');
    expect(element.querySelector<HTMLInputElement>('#auth-password')?.type).toBe('password');
    recovery.set(true);
    await fixture.whenStable();
    expect(element.querySelector('#auth-title')?.textContent).toBe('A fresh start.');
    expect(element.querySelector('#auth-email')).toBeNull();
    expect(element.querySelector('button.primary')?.textContent).toContain('Update password');
  });
});
