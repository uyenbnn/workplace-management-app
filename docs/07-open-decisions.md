# Open decisions and implementation readiness

[← Specification index](worklog-mvp-spec.md)

Version: 0.3 · Updated: 2026-10-26 · Requirements draft

Confirmed requirements and proposed decisions retain their original labels. Original section numbers are preserved for reference.

## 17. Open decisions for the user

The most consequential questions are listed first. Proposed defaults allow the draft to be reviewed without treating unanswered questions as approval.

### Confirmed in the latest review

- Backfill missed weekdays when the app is reopened.
- Copy yesterday's task into the new day's default task.
- timeLog true means time has been logged in another system.
- Support days off with no items created on those dates.

### Remaining questions

1. **Copy details:** proposed: copy story ID, name, points, and status; reset time to 0 and timeLog to false. Should DONE tasks also carry forward?
2. **Copy source:** proposed: use the most recent earlier non-day-off weekday with a task, preferring its generated default; otherwise its earliest manual task. Is this the intended behavior across weekends, days off, and days with multiple tasks?
3. **Existing entries on a day off:** proposed: ask for confirmation before removing all existing entries and marking the date off. Should existing entries instead be retained? The proposed removal behavior is not yet approved.
4. **Task fields:** must story ID and story points be required? Proposed: only task name is required when the user explicitly saves; story ID and points are optional.
5. **Weekends and future dates:** may users manually add entries there? Proposed: yes, while automatic entries remain limited to elapsed weekdays.
6. **Time entry:** are minute-level durations acceptable, including zero, or should the UI enforce a particular increment? Proposed: whole minutes, minimum 0.
7. **Meeting details:** do meetings need editable names, or is the fixed label Meeting sufficient? Proposed: fixed label for MVP.
8. **Navigation:** should Personal appear disabled with a future label, or be hidden until implemented? Proposed: visible with a clear future label.
9. **Data safety:** is local-only persistence sufficient without export/import in the first release? Proposed: export/import deferred.

## Story statistics — approved 2026-10-30

The user approved implementation of `/workplace/statistic`, task-hour totals grouped by
normalized story ID, search, date/status/timeLog filters, and expandable matching details.
See [Story statistics](08-story-statistics.md) for the approved behavior and boundaries.
Existing internal minute storage remains unchanged; statistics displays converted hours.
This supersedes the deferral of reporting and other Workplace subtabs for this view only.

## 18. Implementation readiness

Next step: resolve the remaining task-copy and day-off edge cases and required task fields, then turn the accepted criteria into the first implementation backlog. The confirmed backfill, task-copy, external-logging flag, and day-off requirements are included in this revision. This document specifies the intended app and does not implement or deploy it.

## Approved implementation decisions — 2026-10-26

The user approved the implementation plan and all remaining proposed MVP defaults. This approval supersedes the unanswered/proposed labels above and in the linked documents.

- Carry forward the latest earlier non-day-off weekday task, preferring its default, then earliest manual task (ID breaks timestamp ties). Include DONE tasks. Copy story ID, name, points, and status; reset minutes and timeLog.
- Marking a populated date off requires confirmation before permanently deleting every item and saving the flag atomically. Unmarking an elapsed eligible date in the generation range creates a fresh default pair once.
- Task name is required on explicit save; story ID and points are optional. Whole minutes including zero are accepted. Meetings have a fixed title.
- Manual entries on weekends and future dates are allowed unless marked off. Personal is visible as a disabled future feature. Export/import remains deferred.
- Remaining documented generation, validation, accessibility, local-storage recovery, and revision policies are accepted. No Firebase, authentication, hosting deployment, or Personal functionality is included.

## Hour-based time entry — approved 2026-10-26

The user changed the time unit to hours. All duration inputs, calendar cards, day-dialog lists, and monthly totals use hours (h). Nonnegative fractional hours, including zero, are accepted; the meeting default displays as 1 hour. This supersedes the earlier whole-minute input restriction. For compatibility, schema v1 retains its existing internal minute-based timeSpent field and converts at the UI boundary, accepting finite fractional storage values so decimal-hour input is not rounded to whole minutes. Existing saved durations keep their equivalent value; no data reset or migration is required.

## Shared story status — approved 2026-10-26

When a task is saved with a changed status and a non-empty story ID, update the status of every saved task with that same ID, across all dates and both generated and manual entries. Match trimmed IDs case-sensitively; blank IDs never link tasks. Use the newly saved ID if both ID and status change. Saving other fields without a status change does not synchronize existing statuses. A new task whose status changes from its draft default follows the same rule.

Persist the edited task and all status updates in one document write. Update audit timestamps for changed records; preserve each occurrence’s name, points, duration, logged flag, ID, and date. Failed or stale saves leave all saved occurrences unchanged. No initial reconciliation of previously divergent statuses is performed. This is an explicit exception to task-copy independence: other edits and deletions remain independent.

## Work-week view � approved 2026-10-27

The approved work-week implementation plan adds an alternate Monday�Friday view with a
remembered view preference and all existing worklog actions. This supersedes the deferral of
alternate calendar views for Work week only. See the approved behavior in
[Calendar experience](02-experience-and-journeys.md#work-week-view--approved-2026-10-27).

## CSV transfers - approved 2026-10-27

CSV import/export is now in scope, superseding the earlier deferral. The approved format,
merge rules, preview validation, and metadata boundaries are documented in
[Data and architecture](04-data-and-architecture.md#csv-importexport---approved-2026-10-27).

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

## Dialog tabs and inline TODO editing - approved 2026-10-27

The day dialog switches between Worklog and TODO tabs, showing one panel at a time. Worklog
opens by default; selecting a calendar TODO count opens TODO directly. Use keyboard-accessible
tabs with arrow keys and Home/End navigation. Preserve worklog input and pending TODO drafts
across tab switches.

TODO rows use a leading completion checkbox, inline title, and a trailing
Material delete icon with an accessible label. Remove the separate edit form and Save/Cancel
buttons. Save changed fields when focus leaves the row (click outside or Tab), not when moving
between controls within the row. Also attempt pending saves when leaving the TODO tab or closing.

Reject blank titles inline. Failed or stale saves retain pending text and show a row error for
retry; closing requires explicit discard if anything remains unsaved. Existing TODO deletion
keeps its confirmation; deleting a new unsaved row simply removes its draft. Completion remains
independent of text edits, with failed checkbox saves restoring the saved state. Storage schema,
worklog forms, day-off preservation, generation, and CSV transfer rules remain unchanged.

## Worklog click-out autosave - approved 2026-10-27

Worklog forms save valid pending edits when focus leaves the form (click outside or Tab),
when switching items or tabs, and when closing via Close, Escape, or the backdrop. Keep the
Save item button for explicit saves. Moving between fields or onto the form buttons does not
autosave; Cancel and destructive actions keep their existing confirmations without saving
the pending edits first. Unchanged forms do not autosave.

Use the same validation, shared-story status propagation, revision checks, persistence and
success feedback as explicit Save. Invalid, failed, or stale saves retain inputs and show errors.
Keep unsaved-change protection if navigation or closing would discard a draft that did not save.
TODO inline autosave behavior is unchanged.

## Title-only TODOs - approved 2026-10-27

Remove the optional note entirely. TODOs have only a title and completion checkbox as editable
fields. Keep inline click-out autosave and the trailing delete action. Existing saved TODOs
with the old note field load with their titles, completion, IDs, dates, and audit metadata intact;
drop legacy notes during normalization and omit them on the next successful document write.
Do not overwrite storage on read or relax validation of other fields. This supersedes earlier
TODO note requirements. No storage key change or reset is required.

## Calendar TODO pills - approved 2026-10-27

Replace the calendar TODO count with every reminder as an individual blue pill below the
worklog cards in Month and Work week, including narrow screens and days off. Show the full
title and textual To do/Done state; strike through completed titles. Pills use the supplied
info colors to distinguish reminders from neutral worklog cards. Selecting any pill opens
the day dialog's TODO tab. Preserve reminder order and existing editing/persistence behavior.

## Personal navigation - approved 2026-10-28

Personal is now an enabled navigation link to a skeleton page only, superseding the
disabled future tab decision. Personal task functionality remains deferred.

## CSV TODO and day-off transfer - approved 2026-10-30

CSV now transfers meetings, tasks, title-only TODOs (including completion), and days off.
This supersedes the earlier CSV exclusions. New exports append title,completed to the original
nine columns; imports also accept legacy nine-column worklog exports. TODO rows have empty
worklog fields. DAY_OFF rows have only date and type populated (no ID); dates are their identity.
Month scope applies to all records. Existing IDs and day-off flags win; TODOs are allowed on days off.
Day-off flags are additive and never delete worklogs: a flag conflicting with saved or incoming
worklogs is previewed as conflicting and skipped. Worklogs on an already saved day off remain
invalid; remove that flag explicitly first. Duplicate day-off dates and invalid TODO fields block
the whole import. All additions commit atomically with revision protection and failed-save retention.
Preferences and generation history remain local. Story statuses are not synchronized by import.

## Full CSV replacement - approved 2026-10-30

Import replaces the entire saved item collection (meetings, tasks, and TODOs) and day-off
collection with the validated CSV, across all months. This supersedes all merge, skip,
existing-entry-wins, and additive-day-off policies above. Saved IDs and day-off dates do not
restrict incoming records. Duplicate IDs/dates, invalid fields, and a CSV containing both a
worklog and DAY_OFF for the same date block replacement. TODOs may coexist with DAY_OFF.
A valid header-only CSV clears all items and day-off flags. Legacy exports clear TODOs and
days off because those records are absent. The preview and replacement button explicitly
warn that absent records are removed, including for single-month exports.
Replace in one revision-checked repository write; validation or storage failures preserve
all saved data and the pending preview. Preserve generation start, seal all dates through
import day and imported worklog dates as processed so removed defaults do not reappear.
Normal generation continues on subsequent dates. Preferences remain unchanged.
