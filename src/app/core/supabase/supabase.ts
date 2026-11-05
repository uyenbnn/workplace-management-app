import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { publicConfig } from './public-config.generated';
@Injectable({ providedIn: 'root' })
export class Supabase {
  readonly client = createClient(publicConfig.url, publicConfig.publishableKey);
}
