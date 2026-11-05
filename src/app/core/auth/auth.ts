import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { Supabase } from '../supabase/supabase';
export function safeReturnUrl(value: string | null): string {
  return value?.startsWith('/workplace/') && !value.includes('\\') && !value.includes('//')
    ? value
    : '/workplace/worklog';
}
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly client = inject(Supabase).client;
  readonly user = signal<User | null>(null);
  readonly recovery = signal(window.location.hash.includes('type=recovery'));
  readonly error = signal('');
  readonly editing = signal(false);
  readonly ready: Promise<void>;
  constructor() {
    let eventReceived = false;
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      eventReceived = true;
      this.user.set(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') this.recovery.set(true);
    });
    this.ready = this.client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) this.error.set(error.message);
        if (!eventReceived) this.user.set(data.session?.user ?? null);
      })
      .catch((error: unknown) => {
        this.error.set(error instanceof Error ? error.message : 'Cannot restore session.');
      });
    inject(DestroyRef).onDestroy(() => data.subscription.unsubscribe());
  }
  async signOut(): Promise<boolean> {
    if (this.editing()) {
      this.error.set('Close your editor and resolve pending changes before signing out.');
      return false;
    }
    const { error } = await this.client.auth.signOut();
    this.error.set(error?.message ?? '');
    return !error;
  }
}
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ready;
  return auth.user() && !auth.recovery()
    ? true
    : router.createUrlTree(['/auth'], { queryParams: { returnUrl: safeReturnUrl(state.url) } });
};
