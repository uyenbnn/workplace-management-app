const fs = require('node:fs');
const path = require('node:path');
// Only these two public values may enter the browser bundle.
const test = process.argv.includes('--test');
const SUPABASE_URL = test ? 'http://127.0.0.1:54321' : process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = test
  ? 'unit-test-placeholder'
  : process.env.SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before building or serving.');
}
if (!test && !SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
  throw new Error(
    'SUPABASE_PUBLISHABLE_KEY must be a publishable key, never a secret/service-role key.',
  );
}
const url = new URL(SUPABASE_URL);
if (url.username || url.password)
  throw new Error('Public Supabase URL must not contain credentials.');
if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
  throw new Error('Supabase requires HTTPS outside local development.');
}
const destination = path.join(__dirname, '../src/app/core/supabase/public-config.generated.ts');
fs.writeFileSync(
  destination,
  `export const publicConfig = ${JSON.stringify({ url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY })} as const;\n`,
);
