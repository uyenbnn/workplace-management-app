# Data, persistence, and architecture

[← Specification index](worklog-mvp-spec.md)

Version: 0.3 · Updated: 2026-10-26 · Requirements draft

Confirmed requirements and proposed decisions retain their original labels. Original section numbers are preserved for reference.

## 8. Data model and validation

### Common item fields

| Field       | Type             | Rule                                                             |
| ----------- | ---------------- | ---------------------------------------------------------------- |
| id          | string           | Unique stable identifier                                         |
| date        | date-only string | Valid local calendar date, `YYYY-MM-DD`                          |
| type        | enum             | `MEETING` or `WORK_ON_TASK`                                      |
| timeSpent   | number           | Proposed storage unit: integer minutes; minimum 0                |
| timeLog     | boolean          | Confirmed: true means the time has been logged in another system |
| source      | enum             | Proposed: `AUTO` or `MANUAL`                                     |
| defaultSlot | string or null   | Proposed: date + type identity for generated defaults            |
| createdAt   | UTC timestamp    | Proposed audit metadata                                          |
| updatedAt   | UTC timestamp    | Proposed audit metadata                                          |

### Work-on-task fields

| Field       | Type           | Rule                                                                                      |
| ----------- | -------------- | ----------------------------------------------------------------------------------------- |
| storyId     | string         | Proposed optional, trimmed; repeated IDs allowed across days                              |
| name        | string         | Proposed required on manual creation or explicit save; generated placeholder may be empty |
| storyPoints | number or null | Proposed optional, finite, nonnegative; fractional values allowed                         |
| status      | enum           | `TODO`, `IN_PROGRESS`, `DONE`                                                             |

### Day-level metadata

Proposed `dayOffDates`: a unique collection of valid `YYYY-MM-DD` local dates, independent of items and the processed-date ledger. Absence means not marked off. The flag applies to the whole date; partial-day leave and leave categories are outside the MVP.

Meeting duration defaults to one hour and remains editable; “always 1 hour, can be edited” is interpreted as a default, not a locked duration. Meeting-specific editable titles are not included in the brief.

Proposed validation and semantics:

- Duration input may display hours/minutes but persists whole minutes. Reject negative, nonnumeric, nonfinite, or fractional-minute values.
- A task may have zero minutes while planned; changing status does not change timeSpent or timeLog.
- A timeLog toggle does not send data to an external service. It records a manual boolean only.
- No implied eight-hour day, maximum daily duration, automatic timer, or relationship between story points and hours.
- Show field errors near the input and keep the form open until corrected.

## 11. Persistence and failure handling

Proposed storage key: `worktask.worklog.v1`.

Persist one versioned document containing `schemaVersion`, generation start date, processed-date ledger, `dayOffDates`, item collection, and a revision value for detecting stale edits. Preserve the ledger when individual items are deleted. Explicit day-off removal adjusts the ledger only as defined in [section 6](03-generation-and-days-off.md#6-daily-generation-rules). Proposed migration: older valid documents without `dayOffDates` initialize it to an empty collection without changing existing entries.

- Read and validate stored data before generating or editing entries.
- Retain data across normal reloads and browser restarts on the same browser profile and origin.
- Browser data clearing removes the worklog. Private browsing and storage availability can limit persistence. Communicate this in a brief first-use or settings note.
- A different hostname, port, or browser has separate local data; later deployment does not migrate data automatically.
- On malformed or unsupported-version data, show a recovery state and do not overwrite it with an empty document.
- On write failure, keep unsaved changes available for retry and display a clear error.
- Proposed multi-tab handling: react to storage changes, refresh idle views, and reject stale saves with a reload/review prompt. Recheck the stored revision before writing. localStorage has no transactional compare-and-swap; simultaneous edits across tabs are not guaranteed safe in this MVP and require dedicated conflict handling in a later persistence layer.
- Export/import, backups, and account recovery are deferred; confirm whether a basic backup is necessary for the MVP.

## 14. Technical approach

Requested stack: Angular 22, reusable components, browser local storage. No Firebase SDK is needed for this MVP.

Proposed boundaries:

| Area                        | Responsibility                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------- |
| App shell / main navigation | Workplace and Personal navigation                                                     |
| Worklog calendar            | Month rendering, date selection, item presentation                                    |
| Month navigation            | Previous / Next / Today controls                                                      |
| Calendar day / item card    | Reusable date and work-item UI                                                        |
| Day dialog / item form      | Create, edit, delete, validation, unsaved state                                       |
| Shared controls             | Buttons, form fields, badges, confirmation dialog                                     |
| Worklog service             | Domain operations, defaults, chronological backfill, task copying, day-off exclusions |
| Repository interface        | Read/write boundary independent of storage implementation                             |
| Local-storage repository    | Schema validation, persistence, error handling                                        |
| Date service                | Local dates, weekday checks, month arithmetic, rollover                               |
| Token styles                | Semantic CSS variables and typography mappings                                        |

Keep calendar math and generation logic independent of presentation. A future Firebase repository should be able to replace local storage without rewriting calendar components. Hosting and remote persistence are separate future decisions.

## Approved policy — 2026-10-26

The user approved the proposed schema, field validation, versioned local-storage persistence, recovery, and stale-revision policies for the MVP. Only task name is required on explicit save; story ID and points remain optional. Minutes are nonnegative integers. Export/import is deferred. See [approved decisions](07-open-decisions.md#approved-implementation-decisions--2026-10-26).

## Hour-based time entry — approved 2026-10-26

The user changed the time unit to hours. All duration inputs, calendar cards, day-dialog lists, and monthly totals use hours (h). Nonnegative fractional hours, including zero, are accepted; the meeting default displays as 1 hour. This supersedes the earlier whole-minute input restriction. For compatibility, schema v1 retains its existing internal minute-based timeSpent field and converts at the UI boundary, accepting finite fractional storage values so decimal-hour input is not rounded to whole minutes. Existing saved durations keep their equivalent value; no data reset or migration is required.

## Shared story status — approved 2026-10-26

When a task is saved with a changed status and a non-empty story ID, update the status of every saved task with that same ID, across all dates and both generated and manual entries. Match trimmed IDs case-sensitively; blank IDs never link tasks. Use the newly saved ID if both ID and status change. Saving other fields without a status change does not synchronize existing statuses. A new task whose status changes from its draft default follows the same rule.

Persist the edited task and all status updates in one document write. Update audit timestamps for changed records; preserve each occurrence’s name, points, duration, logged flag, ID, and date. Failed or stale saves leave all saved occurrences unchanged. No initial reconciliation of previously divergent statuses is performed. This is an explicit exception to task-copy independence: other edits and deletions remain independent.

## CSV import/export - approved 2026-10-27

This supersedes the earlier export/import deferral. Replace the local-device badge with an
Import / Export button using a Material transfer icon and an accessible CDK dialog.

- Export current month (default) or all entries, sorted by date and ID, as UTF-8 BOM CSV.
  In work-week view, current month means the anchor date's month.
- The fixed columns are id,date,type,timeSpent,timeLog,storyId,name,storyPoints,status.
  timeSpent retains schema v1 minutes, including fractional minutes. Boolean values are
  true/false; meeting task fields and null story points are empty. Quotes, commas, newlines,
  and Unicode round trip. Prefix formula-like cells and literal leading apostrophes with an
  apostrophe; import removes one leading apostrophe. Use this app's exported CSV format.
- Preserve IDs and editable values. New imports are MANUAL with null defaultSlot and fresh
  audit timestamps. Source/default identity and audit timestamps are not CSV columns.
  Saved generated placeholders may have empty task names and remain transferable.
- Days off, preferences, generation start and processed-date metadata are not transferred
  or changed. Imported story statuses do not synchronize existing entries.
- Preview every row: new, identical, conflicting, invalid. Identical rows are skipped;
  conflicts retain existing entries. Compare transferred fields, not audit metadata.
- Missing IDs, duplicate IDs, invalid fields, malformed CSV, or rows on days off block the
  entire import. Require correction and file reselection; no partial save.
- Require explicit Import N entries confirmation; disable with errors or zero new entries.
  Commit all additions in one repository write with existing revision protection. Retain
  the preview on failure and allow retry. Closing a pending preview requires discard confirmation.
- Export names are worklogs-YYYY-MM.csv and worklogs-all.csv. This transfers entries only,
  not a full device backup. No remote services or storage schema migration are added.

## Daily TODO checklist - approved 2026-10-27

TODO is a distinct manual daily item with a required non-whitespace title and
completion checkbox. It has no duration, timeLog, story fields, or task status. Show it in a
separate Daily TODOs section of the day dialog, with create/edit/delete actions and existing
unsaved-change and deletion confirmations. Completed reminders remain visible in their original
order with checked controls, muted struck-through titles, and textual Done status. Uncheck to reopen.

Calendar cells in Month and Work week show a TODO completed/total count only when reminders
exist; selecting it opens the day dialog. TODOs remain on their assigned local date, including
weekends, future dates, and days off. They are never generated, copied, rolled over, or notified.
Marking a date off preserves TODOs; confirmation removes only its meeting/task worklogs. This
supersedes the earlier all-items day-off rule for TODOs only.

Persist TODO variants in the existing schema-v1 item collection with stable IDs and audit
timestamps, MANUAL source and null defaultSlot. Existing documents require no structural migration:
load their meeting/task items unchanged and accept the additive TODO variant on future saves.
Validate reminder fields at the repository boundary and reject unexpected time/task fields.
Keep revision checks, corrupt-data preservation, and failed-save draft retention. Completion is
independent of editing text, worklog hours, logged totals, story status, and generation metadata.
The existing fixed-column CSV format continues to transfer meetings/tasks only; clearly state
that TODO reminders stay on the device.

## Title-only TODOs - approved 2026-10-27

Remove the optional note entirely. TODOs have only a title and completion checkbox as editable
fields. Keep inline click-out autosave and the trailing delete action. Existing saved TODOs
with the old note field load with their titles, completion, IDs, dates, and audit metadata intact;
drop legacy notes during normalization and omit them on the next successful document write.
Do not overwrite storage on read or relax validation of other fields. This supersedes earlier
TODO note requirements. No storage key change or reset is required.
