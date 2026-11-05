import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, safeReturnUrl } from '../../../../core/auth/auth';
import { Supabase } from '../../../../core/supabase/supabase';
@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  readonly auth = inject(Auth);
  private readonly client = inject(Supabase).client;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly mode = signal<'signin' | 'signup' | 'reset'>('signin');
  readonly showPassword = signal(false);
  readonly heading = computed(() =>
    this.auth.recovery()
      ? 'A fresh start.'
      : this.mode() === 'signup'
        ? 'Make it yours.'
        : this.mode() === 'reset'
          ? 'Forgot your password?'
          : 'Welcome back.',
  );
  readonly description = computed(() =>
    this.auth.recovery()
      ? 'Choose a new password for your account.'
      : this.mode() === 'signup'
        ? 'Create your account and bring a little structure to your day.'
        : this.mode() === 'reset'
          ? "We'll send you a link to get back into your workspace."
          : 'Sign in to pick up where you left off.',
  );
  readonly actionLabel = computed(() =>
    this.auth.recovery()
      ? 'Update password'
      : this.mode() === 'signup'
        ? 'Create account'
        : this.mode() === 'reset'
          ? 'Send recovery link'
          : 'Sign in',
  );
  readonly pending = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true }),
  });
  setMode(mode: 'signin' | 'signup' | 'reset'): void {
    if (this.pending()) return;
    this.mode.set(mode);
    this.error.set('');
    this.message.set('');
    this.showPassword.set(false);
    this.form.markAsUntouched();
  }
  async submit(): Promise<void> {
    if (this.pending()) return;
    const recovery = this.auth.recovery();
    this.form.controls.email.setValidators(recovery ? [] : [Validators.required, Validators.email]);
    this.form.controls.password.setValidators(
      recovery || this.mode() !== 'reset' ? [Validators.required, Validators.minLength(8)] : [],
    );
    this.form.controls.email.updateValueAndValidity();
    this.form.controls.password.updateValueAndValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.pending.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const { email, password } = this.form.getRawValue();
      const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
      const redirect = window.location.origin + '/auth?returnUrl=' + encodeURIComponent(returnUrl);
      if (recovery) {
        const { error } = await this.client.auth.updateUser({ password });
        if (error) throw error;
        this.auth.recovery.set(false);
        await this.router.navigateByUrl(returnUrl);
      } else if (this.mode() === 'signup') {
        const { error } = await this.client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        this.message.set('Check your email to confirm your account, then sign in.');
      } else if (this.mode() === 'reset') {
        const { error } = await this.client.auth.resetPasswordForEmail(email, {
          redirectTo: redirect,
        });
        if (error) throw error;
        this.message.set('If the account exists, a password recovery email has been sent.');
      } else {
        const { error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await this.router.navigateByUrl(returnUrl);
      }
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Authentication failed. Please retry.',
      );
    } finally {
      this.pending.set(false);
    }
  }
}
