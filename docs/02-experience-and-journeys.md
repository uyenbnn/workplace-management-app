# Experience and user journeys

[← Specification index](worklog-mvp-spec.md)

Version: 0.3 · Updated: 2026-10-26 · Requirements draft

Confirmed requirements and proposed decisions retain their original labels. Original section numbers are preserved for reference.

## 5. Calendar experience

**Confirmed:** users can move between months, inspect entries, and select any day to manage its worklog in a pop-up.

**Proposed presentation:**

- Use a seven-column, Monday-first calendar so weekend and weekday dates remain visible.
- Show month/year, Previous, Next, and Today controls.
- Distinguish today, selected day, and weekends without relying only on color.
- Each date cell shows compact item cards: type/name, duration, logged state, and task status where applicable.
- Use “Meeting” for meeting cards and the task name or “Untitled task” for incomplete generated tasks.
- Approved card update: show a non-empty story ID inline before the task name, separated by “·”. Omit the separator when no ID is present. Long titles truncate within the card, with the full text available on hover and in the day editor.
- Preserve a predictable card order: default meeting, default task, then manual entries in creation order.
- Overflow shows a visible “+N more” action opening the day's pop-up; no entries become inaccessible.
- Clicking a card opens the same day pop-up with that item selected. Card clicks must not also trigger another pop-up.
- Month navigation does not create future entries.
- Weekends allow manual entries, pending confirmation; they never receive automatic entries.
- Marked days off show a visible “Day off” label and no item cards. The day pop-up provides Mark as day off / Remove day off actions, including for future dates.

On narrow screens, retain month navigation and date selection, use compact count/type indicators, and show full details in an accessible full-screen dialog. Exact responsive breakpoints are implementation decisions.

## 7. Pop-up and editing behavior

Proposed day pop-up structure:

- Date heading and list of that day's items.
- Day-off control and visible state; apply the confirmation and creation restrictions in [section 6](03-generation-and-days-off.md#6-daily-generation-rules).
- Add item action with Meeting / Work on task selection.
- Selected-item form and Save / Cancel controls.
- Delete action for existing items with confirmation identifying the item and date.
- Close action; if unsaved changes exist, allow the user to keep editing or discard them.

Save validates and persists the selected item, updates the calendar, and reports success only after storage succeeds. Cancel discards unsaved form changes. Deleting one item leaves other entries for that date intact. An empty day permits adding an item unless marked as a day off.

Proposed limitations: an item's date and type are fixed after creation. Users can delete and recreate an item if either was incorrect. Batch editing and deleting all items for a day are deferred.

## 9. User journeys

### First visit

1. User opens the website.
2. App initializes local data and opens the current month's worklog.
3. On a weekday, today's Meeting and Work on task entries appear using proposed defaults.
4. User selects today, fills task details, adjusts durations, and saves.
5. Calendar reflects the saved values.

### Daily maintenance

1. User returns; the app backfills missed weekdays, skips days off, and copies task details forward under the rules in [section 6](03-generation-and-days-off.md#6-daily-generation-rules).
2. User selects today or another date and reviews its items.
3. User updates task status and time, then marks time as logged when appropriate.
4. User saves and can revisit the same information after reload.

### Review and correction

1. User moves to an earlier month.
2. User selects a date and edits an item, adds missed work, or deletes an unwanted entry.
3. Changes persist; later visits do not undo the correction.

### Plan a day off

1. User selects a date, including a future date, and chooses Mark as day off.
2. If entries already exist, the proposed confirmation identifies that all of them will be removed; the user confirms or cancels.
3. The saved date displays Day off and remains empty across reopening and backfilling.
4. User can remove the flag to make the date available for work again under [section 6](03-generation-and-days-off.md#6-daily-generation-rules).

## 10. Use cases

| ID    | Use case                | Preconditions / trigger                               | Expected result                                                                                                               |
| ----- | ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| UC-01 | View month              | Open tracker or navigate months                       | Correct dates and saved entries appear                                                                                        |
| UC-02 | Generate daily defaults | Eligible date has not been processed                  | One default of each type is saved once                                                                                        |
| UC-03 | Edit generated meeting  | Select meeting in day pop-up                          | Editable duration and logged state persist                                                                                    |
| UC-04 | Edit task               | Select task in day pop-up                             | Story fields, status, time, and logged state persist                                                                          |
| UC-05 | Add manual item         | Select a day not marked off, choose Add and type      | Valid entry appears on that date                                                                                              |
| UC-06 | Delete item             | Select item and confirm deletion                      | Only selected item disappears permanently                                                                                     |
| UC-07 | Cancel changes          | Modify form, choose Cancel/discard                    | Previously saved entry remains unchanged                                                                                      |
| UC-08 | Resume after absence    | Reopen after missed weekdays                          | Backfill creates missing defaults, carries tasks forward, and skips days off without duplicates                               |
| UC-09 | Handle storage failure  | A local read/write fails                              | Clear error; no false save success or destructive reset                                                                       |
| UC-10 | Mark day off            | Select a date and save its day-off state              | Date stays empty and is excluded from generation                                                                              |
| UC-11 | Remove day off          | Unmark a previously excluded date                     | Generation eligibility follows [section 6](03-generation-and-days-off.md#6-daily-generation-rules) without duplicate defaults |
| UC-12 | Copy daily task         | Generate an eligible date with an earlier source task | Independent task is created with copied details and reset daily tracking fields                                               |

## Work-week view � approved 2026-10-27

Month and Work week are adjacent view choices, displaying one calendar at a time. Work week
shows Monday�Friday columns with every card in the existing order; narrow screens stack those
five dates. Both views use the same worklog data, day editor, item actions, validation, confirmations,
and storage failure handling. There is no hourly timeline or drag-and-drop.

Remember the selected view separately from worklog data (`worktask.worklog.view`); missing,
invalid, or unreadable preferences default to Month. Failed preference writes show a message but
allow switching. Summaries describe the displayed month or five-day work week.

Retain the date anchor across view switches, including after closing a day editor. Without a
selected date, use today within the displayed month, otherwise that month's first day. Weekends
anchor the preceding Monday�Friday. Previous/Next move a month or seven days; Today returns
to today's period. Range headings include both endpoints' month and year. View changes and
navigation do not generate or mutate worklogs and cannot dismiss an open editor.

## Multiple item deletion — approved 2026-10-27

The day dialog provides independent item checkboxes, Select all (including a partial-selection
state), a selected count, and Delete selected. Selection is separate from the item being edited.
One confirmation identifies the date, count, and selected titles and explains permanent deletion,
including logged entries. If the edited item is included, confirmation also covers discarding its
unsaved changes. An unrelated editor draft remains intact. Cancel retains selection and drafts.

Delete all selected records in one revision-checked repository write. On failure retain the items,
selection, and pending edits for retry; never show a success toast. On success clear the checkboxes,
clear the editor only if its item was deleted, and show a count-based success toast. Preserve
independent generation metadata so deleted defaults do not regenerate. Empty selections cannot
be deleted. Existing single-item deletion remains available. No schema migration is needed.

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

Approved TODO layout adjustment: place the + TODO button below the checklist at the bottom
of the TODO panel, spanning its full available width.

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

## Enter to add TODOs - approved 2026-10-27

Pressing Enter in a TODO title saves that row and appends a new blank reminder with its
title focused. Invalid or failed saves retain the current input and error without creating
another row. Ignore Enter during IME composition and held-key repeats. The + TODO action
also focuses the new title.
