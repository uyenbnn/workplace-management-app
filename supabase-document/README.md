# Supabase migration knowledge base

Updated: 2026-11-04

This folder records the approved move from browser-local worklogs to private Supabase accounts.
Read the guides in order:

1. [Architecture](01-architecture.md)
2. [Setup and deployment](02-setup-and-deployment.md)
3. [Local-data migration](03-local-data-migration.md)
4. [Verification and operations](04-verification-and-operations.md)

## Current scope

Legacy browser-data import is deferred by the user's latest decision. The default app does
not inspect or upload the old worktask.worklog.v1 document and shows no migration prompt.
It loads the signed-in account's cloud document or initializes a fresh one. Existing legacy
browser data is left untouched. The import implementation is retained, disabled by default
behind ENABLE_LOCAL_WORKLOG_IMPORT, for a later explicit decision.

## Implemented

- Supabase client, email/password account screens and Workplace route protection.
- Asynchronous repository, serialized saves, expected-revision conflict handling, and draft retention.
- Fresh-cloud initialization; legacy import implementation retained but inactive.
- SQL migration with ownership, RLS, payload validation and transactional revision checks.
- Automated application and embedded PostgreSQL verification.
- Production public variables were supplied by the user's Vercel integration.
- The two public variables were added to Preview for the same Supabase project.
- Local public configuration was generated without putting privileged credentials in the app.

## Live configuration verified

- Project reference: lasdaibwrssqnudrtlvf.
- Existing Vercel project: workplace-management-app, team tomato-06a0.
- Supabase Auth responds; email signup is enabled and email confirmation is required.
- Latest public probes for worklog_documents and save_worklog_document return HTTP 401 / SQLSTATE 42501, consistent with object availability and anonymous access denial. Authenticated persistence remains to be verified end to end.
- Vercel CLI authentication works. The separate Vercel MCP connection lacks team authorization.
- Production database secrets cannot be pulled from Vercel; they are redacted.

## Pending before rollout

Verify the applied SQL against the checked-in migration, configure Auth redirect URLs,
and verify sign-in/recovery, persistence, two-account isolation, two-device conflicts and mobile
keyboard behavior against the deployed app. See the setup guide for the exact commands.
No production database mutation or application deployment has been performed.

Preview and production intentionally share this database. Preview saves affect live account data.
Personal functionality, offline writes, Realtime subscriptions and team sharing remain deferred.
