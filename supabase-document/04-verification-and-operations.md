# Verification and operations

Updated: 2026-11-04

## Current scope

Legacy browser-data migration is deferred. The active app loads the signed-in user's cloud
document or creates a fresh one with normal initial defaults. It does not inspect or modify
the old browser worklog. ENABLE_LOCAL_WORKLOG_IMPORT defaults to false; the earlier import
implementation and its tests remain available for a later explicit decision.

## Checks completed

- npm test -- --watch=false: 132 tests passed across 22 files. These cover existing domain,
  editing, TODO, CSV and statistics behavior, asynchronous saves and conflicts, account
  isolation of responses, fresh-cloud initialization with corrupt legacy data present,
  authentication validation, mode switching and password visibility.
- npm run test:database: passed against embedded PostgreSQL (PGlite), executing the real SQL
  migration with test auth roles. Covers owner isolation, anonymous/direct-write denial,
  atomic validation failure, revision concurrency and TODO/day-off compatibility.
- npm run build: passed with the project's real public configuration. The initial bundle
  is about 519.5 kB against a 500 kB warning budget. Auth styles are about 4.4 kB against a
  4 kB warning budget, below the 8 kB error budget. Budgets were not raised.
- npm run format:check: ran; existing issues remain in AGENTS.md and
  src/app/features/personal/pages/personal-page/personal-page.html. These unrelated files
  were not reformatted. Changed implementation and documentation files were formatted.
- Desktop (1440 x 1000) and mobile (375 x 812, 320 x 812) login screenshots were reviewed.
  The page stacks at narrow widths without horizontal clipping. Auth form mode, accessible
  labels, validation, visibility control and pending behavior are covered by DOM tests.
- Public probes of worklog_documents and save_worklog_document now return HTTP 401 /
  SQLSTATE 42501 instead of missing-object errors, consistent with schema availability and
  anonymous access denial. This is not an authenticated read/write test.
- Supabase Auth public settings respond successfully: email signup enabled, email
  confirmation required.
- Vercel Production and Preview public variables point to the same Supabase project.
- Earlier npm audit --omit=dev found zero production vulnerabilities. Three development
  findings were reported by npm; unrelated dependency versions were not upgraded.

No lint script exists; no lint pass is claimed. Native computer automation was unavailable
because of Windows sandbox error 1385; isolated headless Edge provided local visual checks.

## Pending live acceptance

1. Confirm live SQL matches the checked-in migration using an authenticated Supabase session.
   Production database credentials are redacted by Vercel and no authenticated Supabase MCP
   connection is available here.
2. Verify Site URL, allowed Auth redirects and email delivery. Create/confirm an account,
   sign in and recover its password through actual email links.
3. Start from a fresh account, save/edit/delete worklogs and TODOs, reload and check them
   on another device. Old browser data must not trigger an import prompt.
4. Save on two devices from the same revision: the second save must retain its draft and
   require review. Confirm a second account cannot access the first account's document.
5. Test network failure/session expiry during autosave, keyboard dialogs and narrow
   authenticated worklog screens. Local login screenshots do not substitute for those checks.
6. Verify a preview before promoting to production. Preview actions affect live account data.

No cloud SQL changes, Auth redirect changes or application deployment were performed by
the agent. The latest schema probes are read-only/unauthenticated rejection checks.

## Troubleshooting

- Missing public config: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local or
  Vercel, then rebuild. Do not use a privileged key.
- Missing table or RPC: inspect/apply the checked-in SQL and allow schema-cache refresh.
  Do not use local storage as a fallback database.
- Anonymous HTTP 401 / 42501 is expected. A signed-in permission error needs session and
  RLS/RPC-grant inspection; never disable RLS as a workaround.
- Stale revision: use Reload saved data for review (keeps draft), review the refreshed saved
  list, then deliberately retry the retained edit. Close/discard only when intended.
- Auth links: check Site URL, allowed redirect origins, templates and email delivery.
- Old local data: it is preserved but inactive. Legacy import is deferred; CSV replacement
  remains available as its existing explicit feature.

## Rollout and rollback

The additive database schema must exist before deploying the Angular change. Keep cloud
tables and history intact when reverting an application release. An older local-only app
does not contain subsequent cloud edits; export current cloud data before rollback.
Never drop/reset the database to recover an application error.

    npm run format:check
    npm run build
    npm test -- --watch=false
    npm run test:database
    node --env-file=.env.database.local tools/worklog-database.mjs

The last command is read-only unless --apply is explicitly provided.
