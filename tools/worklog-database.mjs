import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString || connectionString === '[SENSITIVE]') {
  console.error(
    'Set SUPABASE_DB_URL locally from Supabase Connect. Vercel redacts production database secrets; never commit this value.',
  );
  process.exit(1);
}
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true } });
const sql = await readFile(
  new URL('../supabase/migrations/202611040001_worklog_documents.sql', import.meta.url),
  'utf8',
);
const version = '202611040001';
const checksum = createHash('sha256').update(sql).digest('hex');
try {
  await db.connect();
  const tables = await db.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  const policies = await db.query(
    "select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename, policyname",
  );
  console.log(JSON.stringify({ tables: tables.rows, policies: policies.rows }, null, 2));
  if (process.argv.includes('--apply')) {
    await db.query('begin');
    await db.query("select pg_advisory_xact_lock(hashtext('workplace-worklog-schema'))");
    await db.query(
      'create table if not exists public.worklog_schema_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())',
    );
    await db.query('revoke all on public.worklog_schema_migrations from anon, authenticated');
    const previous = await db.query(
      'select checksum from public.worklog_schema_migrations where version = $1',
      [version],
    );
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== checksum)
        throw new Error('Migration checksum mismatch; review the existing schema.');
      console.log('Migration already applied with the same checksum.');
    } else {
      const existing = await db.query(
        "select to_regclass('public.worklog_documents') as table_name, to_regprocedure('public.save_worklog_document(jsonb,bigint)') as rpc",
      );
      if (existing.rows[0].table_name || existing.rows[0].rpc)
        throw new Error(
          'Worklog objects already exist without a recorded migration. Inspect before proceeding.',
        );
      await db.query(sql);
      await db.query(
        'insert into public.worklog_schema_migrations(version, checksum) values ($1, $2)',
        [version, checksum],
      );
      console.log('Applied worklog migration atomically.');
    }
    await db.query('commit');
  } else
    console.log('Read-only inspection completed. Use --apply after reviewing existing schema.');
} catch (error) {
  await db.query('rollback').catch(() => {});
  // Never log connection objects or URLs containing credentials.
  console.error(error instanceof Error ? error.message : 'Database operation failed.');
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
