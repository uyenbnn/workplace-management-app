# Daily generation, task copying, and days off

[← Specification index](worklog-mvp-spec.md)

Version: 0.3 · Updated: 2026-10-26 · Requirements draft

Confirmed requirements and proposed decisions retain their original labels. Original section numbers are preserved for reference.

## 6. Daily generation rules

**Confirmed:** missed weekdays are backfilled when the app is reopened, the default task copies yesterday's task, and days off receive no new items. The following operational details remain **Proposed** where they go beyond those confirmed requirements:

1. On first use, set a generation start date to today's local date. Create today's two defaults if today is Monday–Friday and not marked as a day off. Do not populate earlier history.
2. On later launches, generate missing weekdays from the start date through today, including days when the app was closed. Exclude dates marked as days off. Process dates in chronological order so copied tasks can feed subsequent backfilled dates.
3. While open, check for date rollover and reconcile when the app regains focus or visibility.
4. Use the device's local calendar date for worklog dates. Store it as `YYYY-MM-DD`, separately from UTC audit timestamps.
5. Create exactly one default slot of each type for each eligible date. A manual item does not satisfy or replace a default slot.
6. Track processed dates independently of the remaining items. Deleting a default must not cause regeneration.
7. Never overwrite edits or change an existing item's logged state during reconciliation.
8. Generate defaults and record the processed date in one persisted document update. Retry safely after a failed write.

Local storage cannot generate entries while the website is closed. This policy creates them on the next visit; it does not imply a background scheduling service.

Proposed defaults:

| Field         | Meeting        | Work on task                                        |
| ------------- | -------------- | --------------------------------------------------- |
| Type          | `MEETING`      | `WORK_ON_TASK`                                      |
| Display title | Meeting        | Copied task name; Untitled task if no source exists |
| timeSpent     | 60 minutes     | 0 minutes                                           |
| timeLog       | `false`        | `false`                                             |
| storyId       | Not applicable | Copy from source; empty if none                     |
| name          | Not applicable | Copy from source; empty if none                     |
| storyPoints   | Not applicable | Copy from source; unset if none                     |
| status        | Not applicable | Proposed: copy from source; `TODO` if none          |

### Task carry-forward details

**Confirmed:** copy yesterday's task. **Proposed interpretation:** use the most recent earlier non-day-off weekday containing a Work on task item, allowing Monday to inherit Friday's task and skipping days off. Prefer that date's generated default task; if it was deleted or absent, use the earliest-created manual task, breaking timestamp ties by ID. Copy only one task, preserving the two-default-items rule. If no source exists, use the blank fallback above.

Copy storyId, name, storyPoints, and status into a new independent entry with a new ID and date. Reset timeSpent to 0 and timeLog to false because duration and external logging belong to each day's worklog. Do not copy meeting edits; each generated meeting starts at 60 minutes and false. Copying DONE tasks and the exact source-selection rule remain open decisions. Subsequent edits or deletions of the source do not retroactively change copies.

### Day-off behavior

**Confirmed:** users can choose a day off, and no items are created that day. This exclusion takes precedence over daily generation, missed-day backfilling, and task copying.

**Proposed interaction details:**

- Mark or unmark any past, current, or future date from its day pop-up. Persist the date-level flag independently of work items and generation history.
- On an empty date, marking it off saves the flag immediately. On a populated date, show a confirmation explaining that all existing items, including manual and logged entries, will be removed. Only confirmation removes them and saves the day-off flag together; Cancel leaves everything unchanged. The treatment of existing entries needs user confirmation before implementation.
- Disable manual item creation while the date is marked off; offer Remove day off first. This keeps the date empty and makes the no-items rule consistent.
- Reload, focus changes, and backfilling never recreate entries on a marked day off.
- Removing day off from an elapsed weekday within the generation range creates a fresh default pair once, using the carry-forward rule. Explicitly reset that date's generation eligibility; previously removed entries are not restored. Future weekdays wait until their date arrives, and weekends remain manual-only.
- Save flag changes, item removals, and ledger updates in one document write. A write failure leaves the previous saved state intact and reports an error.

## Approved policy — 2026-10-26

The user approved this document's proposed generation, copying, and day-off policies in the implementation plan. DONE tasks carry forward. Confirm before deleting every entry on a populated day when marking it off; removing the flag on an elapsed eligible date creates fresh defaults once. See [approved decisions](07-open-decisions.md#approved-implementation-decisions--2026-10-26).

## Shared story status — approved 2026-10-26

When a task is saved with a changed status and a non-empty story ID, update the status of every saved task with that same ID, across all dates and both generated and manual entries. Match trimmed IDs case-sensitively; blank IDs never link tasks. Use the newly saved ID if both ID and status change. Saving other fields without a status change does not synchronize existing statuses. A new task whose status changes from its draft default follows the same rule.

Persist the edited task and all status updates in one document write. Update audit timestamps for changed records; preserve each occurrence’s name, points, duration, logged flag, ID, and date. Failed or stale saves leave all saved occurrences unchanged. No initial reconciliation of previously divergent statuses is performed. This is an explicit exception to task-copy independence: other edits and deletions remain independent.

## TODO exception - approved 2026-10-27

Daily TODO reminders are manual-only and may exist on days off. Marking a day off preserves
them and removes only meetings/tasks after the existing confirmation. Generation and copying
never create, move, complete, or duplicate TODOs. See the approved Daily TODO checklist decision.
