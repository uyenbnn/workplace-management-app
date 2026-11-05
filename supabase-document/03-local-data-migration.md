# Migrating browser-local worklogs

> Current scope (2026-11-04): legacy browser-data import is deferred. The active app loads or initializes a fresh account-owned cloud document. Import instructions below are retained for future use; the feature is disabled by default.

## User journey

1. Sign in on the browser/origin containing the old worklog. A different hostname or browser
   cannot see that localStorage value.
2. Before cloud creation or generation, review the migration panel: item count, days off,
   generation start and processed-date count.
3. Download the full JSON backup. It preserves raw device data, including corrupt content
   for recovery. Store it privately.
4. Confirm Import and verify local worklog. The transfer validates schema v1, checks the cloud
   account is empty, saves the complete normalized document and reads it back.
5. Only a matching readback acknowledges completion. Normal chronological generation can
   then continue from the preserved ledger.

Original worktask.worklog.v1 is never deleted or rewritten by this flow. IDs, item order, TODO
completion, original timestamps, durations, default slots and deletion history are preserved.
Legacy TODO notes are normalized away according to the existing approved schema rules.
Only revision changes to the cloud server's revision.

## Errors and retries

Corrupt local JSON blocks import and automatic cloud creation. Download the raw backup and
recover it separately, or explicitly choose to start an empty cloud worklog.
A different existing cloud document blocks automatic import. Download the device backup and
continue with cloud data; this flow never merges or replaces existing cloud records.

A lost response can occur after a successful commit. Retry reads the cloud document first:
an exact content match ignoring revision can be verified without writing again. Comparison
normalizes object-key order because JSONB reorders keys. A mismatch remains blocked.

The acknowledgement is scoped by account and a SHA-256 fingerprint of the raw local value.
Changed local data or a different account requires review again. If browser storage prevents
saving the acknowledgement, the transfer remains valid but review may reappear after reload.

## CSV is different

Existing CSV import still replaces all items and days off after its explicit preview warning.
It does not carry generation history or preferences. Preserve its header-only clear behavior,
whole-document revision checks and processed-date sealing. CSV export is useful for exchanging
entries; the migration JSON is the full legacy backup.

The retained device document is a migration snapshot, not a continuously updated cloud backup.
