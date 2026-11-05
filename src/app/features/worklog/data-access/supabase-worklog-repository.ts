import { Injectable, computed, inject } from '@angular/core';
import { Auth } from '../../../core/auth/auth';
import { Supabase } from '../../../core/supabase/supabase';
import { decodeDocument, WorklogDocument } from '../domain/worklog';
import type { WorklogRepository } from './worklog-repository';
@Injectable({ providedIn: 'root' })
export class SupabaseWorklogRepository implements WorklogRepository {
  private readonly auth = inject(Auth);
  private readonly client = inject(Supabase).client;
  readonly identity = computed(() => this.auth.user()?.id ?? null);
  readonly editing = this.auth.editing;
  private owner(): string {
    const owner = this.identity();
    if (!owner) throw new Error('Sign in before accessing your worklog.');
    return owner;
  }
  async read(): Promise<WorklogDocument | null> {
    const owner = this.owner();
    const { data, error } = await this.client
      .from('worklog_documents')
      .select('document,revision')
      .eq('owner_id', owner)
      .maybeSingle();
    if (owner !== this.identity()) throw new Error('Account changed. Reload your worklog.');
    if (error) throw new Error('Cannot read cloud worklog: ' + error.message);
    if (!data) return null;
    return decodeDocument(JSON.stringify({ ...data.document, revision: data.revision }));
  }
  async write(
    document: WorklogDocument,
    expectedRevision: number | null,
  ): Promise<WorklogDocument> {
    const owner = this.owner();
    const validated = decodeDocument(JSON.stringify(document));
    const { data, error } = await this.client.rpc('save_worklog_document', {
      payload: validated,
      expected_revision: expectedRevision,
    });
    if (owner !== this.identity())
      throw new Error('Account changed. Your previous account was not loaded into this session.');
    if (error)
      throw new Error(
        error.code === '40001' || error.code === '23505'
          ? 'Worklog changed on another device. Keep your draft and reload to review before saving.'
          : 'Cloud save failed. Keep your changes and retry: ' + error.message,
      );
    return decodeDocument(JSON.stringify(data));
  }
}
