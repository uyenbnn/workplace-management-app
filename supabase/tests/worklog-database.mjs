import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`
    create schema auth;
    create role anon;
    create role authenticated;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated, anon;
    insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
  `);
  await db.exec(
    await readFile(
      new URL('../migrations/202611040001_worklog_documents.sql', import.meta.url),
      'utf8',
    ),
  );
  const owner = '11111111-1111-1111-1111-111111111111';
  const other = '22222222-2222-2222-2222-222222222222';
  const base = {
    schemaVersion: 1,
    revision: 0,
    generationStartDate: '2026-11-04',
    processedDates: [],
    dayOffDates: [],
    items: [],
  };
  const save = (document, revision) =>
    db.query('select public.save_worklog_document($1::jsonb, $2::bigint) as document', [
      JSON.stringify(document),
      revision,
    ]);
  await db.exec('set role anon');
  await assert.rejects(save(base, null), /permission denied/);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
  const result = await save(base, null);
  assert.equal(result.rows[0].document.revision, 1);
  await assert.rejects(
    db.query('update public.worklog_documents set revision = 10'),
    /permission denied/,
  );
  await assert.rejects(db.query('delete from public.worklog_documents'), /permission denied/);
  await assert.rejects(save(base, null), /Stale revision/);
  const attempts = await Promise.allSettled([save(base, 1), save(base, 1)]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((r) => r.status === 'rejected').length, 1);
  const current = (await db.query('select document from public.worklog_documents')).rows[0]
    .document;
  assert.equal(current.revision, 2);
  const meeting = {
    id: 'meeting',
    date: '2026-11-04',
    type: 'MEETING',
    source: 'MANUAL',
    defaultSlot: null,
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
    timeSpent: 12.5,
    timeLog: false,
  };
  await save({ ...base, items: [meeting] }, 2);
  const invalid = [
    { ...base, schemaVersion: 2 },
    { ...base, items: [{ ...meeting, timeSpent: -1 }] },
    { ...base, items: [meeting, meeting] },
    { ...base, items: [meeting], dayOffDates: ['2026-11-04'] },
    { ...base, processedDates: ['2026-02-30'] },
    { ...base, items: [{ ...meeting, source: 'AUTO', defaultSlot: 'wrong' }] },
    {
      ...base,
      items: [
        {
          ...meeting,
          type: 'WORK_ON_TASK',
          name: '',
          storyId: '',
          storyPoints: null,
          status: 'INVALID',
        },
      ],
    },
    {
      ...base,
      items: [
        {
          id: 'todo',
          date: '2026-11-04',
          type: 'TODO',
          title: ' ',
          completed: false,
          source: 'MANUAL',
          defaultSlot: null,
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt,
        },
      ],
    },
  ];
  for (const document of invalid)
    await assert.rejects(save(document, 3), /Invalid worklog document/);
  assert.equal(
    (await db.query('select revision from public.worklog_documents')).rows[0].revision,
    3,
  );
  const todo = {
    id: 'todo',
    date: '2026-11-04',
    type: 'TODO',
    title: 'Review',
    completed: true,
    source: 'MANUAL',
    defaultSlot: null,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  };
  await save({ ...base, items: [todo], dayOffDates: [todo.date] }, 3);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
  assert.equal((await db.query('select * from public.worklog_documents')).rows.length, 0);
  await assert.rejects(save(base, 4), /Stale revision/);
  await save(base, null);
  assert.equal((await db.query('select * from public.worklog_documents')).rows.length, 1);
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await assert.rejects(save(base, null), /Sign in required/);
  console.log(
    'Database checks passed: ownership, anonymous denial, direct-write denial, atomic revisions, concurrent stale writes, validation, TODO/day-off compatibility.',
  );
} finally {
  await db.close();
}
