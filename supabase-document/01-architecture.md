# Architecture and decisions

> Current scope (2026-11-04): legacy browser-data import is deferred. The active app loads or initializes a fresh account-owned cloud document. Import instructions below are retained for future use; the feature is disabled by default.

## Ownership and persistence

Each authenticated user owns one row in public.worklog_documents. owner_id references
auth.users. The JSONB document preserves schemaVersion 1, items, generationStartDate,
processedDates and dayOffDates. The existing minute-based timeSpent field still accepts
fractional values; UI durations remain hours.

The document model preserves existing all-or-nothing operations: shared story-status changes,
CSV replacement, generation plus its ledger, and worklog removal when setting a day off.
TODOs retain their independent title/completion semantics. Statistics reads the document
without creating defaults or writing it.

Only authenticated owners can SELECT their row under RLS. Browser roles cannot INSERT,
UPDATE or DELETE the table. save_worklog_document is a restricted SECURITY DEFINER RPC
with an empty search path and an owner derived exclusively from auth.uid(). It validates
the complete payload, creates an absent document only when expected_revision is null, or
atomically updates the row matching the current revision. The server increments revision.
A conflict returns SQLSTATE 40001; no part of the proposed replacement is saved.

## Application flow

Workplace route guard -> restored Supabase session -> async repository -> validated
WorklogDocument -> domain transformations -> save RPC -> confirmed document -> rendered state.

The existing repository interface accepts synchronous implementations for isolated legacy
tests, but production read/write calls are Promise-based. The old local implementation is
retained for legacy decoding/testing, not selected by production dependency injection.

WorklogStore serializes writes, derives each queued update from the latest confirmed document,
and keeps saved state unchanged until confirmation. Read versions and account checks prevent
older responses from replacing newer state. Focus/visibility/route entry trigger fresh reads;
storage events are no longer the cloud invalidation mechanism.

Dialogs await saves when switching items/tabs or closing, disable controls while saving, and
retain drafts and errors after failures. Success feedback follows confirmation. Stale edits
require an explicit reload/review; they are never automatically rebased onto a newer document.
Statistics clears stale totals on failed reads. Generation still happens on tracker visits and
local-date rollover, never on a server schedule.

## Session boundaries

Signing out is blocked while an editor, save or migration is active. Account changes clear
loaded worklogs. Open editors remember their original account and cannot save into a different
account. Session expiry preserves editor input but unauthenticated writes fail. Supabase's
session cache, view preference and per-account migration acknowledgement remain browser-local;
localStorage is no longer the worklog database.

## Browser configuration

Only SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are generated into the browser bundle.
Public keys identify the API; RLS and authenticated identity enforce access.
Database URLs, secret keys and service-role keys must never enter generated public config.

No offline queue, automatic conflict merging, Realtime subscription, relational redesign or
workspace membership is introduced. All-time statistics remains client-side over one document;
large histories may justify a later relational model.
