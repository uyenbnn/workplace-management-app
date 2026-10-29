# Acceptance criteria and verification

[← Specification index](worklog-mvp-spec.md)

Version: 0.3 · Updated: 2026-10-26 · Requirements draft

Confirmed requirements and proposed decisions retain their original labels. Original section numbers are preserved for reference.

## 15. Acceptance criteria

Proposed criteria inherit the unconfirmed policies above; resolve [section 17](07-open-decisions.md#17-open-decisions-for-the-user) before treating all of them as final.

| ID    | Given / when                                                  | Then                                                                                                                                                  |
| ----- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | User opens tracker                                            | Current local month and Workplace → Worklog tracker appear                                                                                            |
| AC-02 | User selects Previous / Next, including year boundaries       | Correct month dates and existing entries appear                                                                                                       |
| AC-03 | First use is a weekday not marked off                         | Exactly one default Meeting and one default Work on task exist for today                                                                              |
| AC-04 | First use is Saturday or Sunday                               | No defaults are created for that date                                                                                                                 |
| AC-05 | User refreshes or repeatedly revisits a processed day         | No duplicate defaults appear; edits remain                                                                                                            |
| AC-06 | User returns after several missed weekdays                    | Eligible dates from the generation start date through today are reconciled chronologically, excluding days off                                        |
| AC-07 | User views a future month                                     | No future defaults are created by navigation                                                                                                          |
| AC-08 | User clicks a date or an item                                 | One day pop-up opens with the correct date/item context                                                                                               |
| AC-09 | User changes Meeting duration from 60 to 30 minutes and saves | 30 minutes remains after reload                                                                                                                       |
| AC-10 | User saves task fields and each supported status              | Saved values remain after reload                                                                                                                      |
| AC-11 | User adds a valid manual item on a date not marked off        | Item is saved to the selected date without replacing defaults                                                                                         |
| AC-12 | User cancels edits or cancels deletion                        | Saved data remains unchanged                                                                                                                          |
| AC-13 | User confirms deletion of a default and reloads               | Deleted item stays deleted; other items remain                                                                                                        |
| AC-14 | User submits invalid duration or story points                 | Field error appears; invalid data is not saved                                                                                                        |
| AC-15 | User toggles timeLog and saves                                | Boolean persists without changing task status or duration                                                                                             |
| AC-16 | Storage write fails                                           | App reports failure and retains the user's pending edit                                                                                               |
| AC-17 | Stored data is malformed                                      | Recovery message appears; original stored content is not overwritten                                                                                  |
| AC-18 | Local day changes while open or app regains focus             | Eligible defaults appear once for the newly reached date                                                                                              |
| AC-19 | User works with keyboard or narrow viewport                   | All items and editing actions remain reachable                                                                                                        |
| AC-20 | A new eligible day has a source task                          | Its default task copies the selected source's storyId, name, storyPoints, and status; timeSpent is 0 and timeLog is false                             |
| AC-21 | Backfill crosses weekends or marked days off                  | Excluded dates get no defaults; subsequent tasks use the source-selection rule in [section 6](03-generation-and-days-off.md#6-daily-generation-rules) |
| AC-22 | User marks an empty date off and reloads                      | Day-off label persists and no items are generated or manually created while marked off                                                                |
| AC-23 | User marks a populated date off                               | Proposed: confirmation is required; confirming removes all items and saves the flag, while cancelling changes nothing                                 |
| AC-24 | User removes day off from an elapsed eligible weekday         | Proposed: a fresh default pair is created once; repeated reconciliation adds no duplicates                                                            |
| AC-25 | User removes day off from a future date or weekend            | No immediate automatic entries are created                                                                                                            |
| AC-26 | User changes a source task after copying                      | Existing copied entries remain unchanged                                                                                                              |
| AC-27 | A day-off save fails                                          | Existing saved items, day-off state, and ledger remain unchanged; the failure is visible                                                              |

## 16. Verification plan

- Unit-check date boundaries (month/year changes, leap days, weekends) and local date handling.
- Unit-check idempotent generation, missed-day catch-up, preserved edits, deleted default slots, and first launch on a weekend.
- Verify chronological task copying, no-source fallback, multiple source tasks, DONE sources, weekend/day-off gaps, reset daily fields, and independence of copied entries.
- Verify day-off persistence, backfill exclusion, blocked manual creation, populated-day confirmation/cancellation, unmarking behavior, and write failure without partial changes.
- Verify validation and schema error handling at the repository boundary.
- Exercise complete create/edit/delete/cancel journeys with reload persistence.
- Simulate storage failure and stale edits from another tab.
- Review calendar overflow, mobile dialog layout, keyboard navigation, and focus restoration.
- Verify all specified task statuses and editable meeting duration, without automatic status/timeLog coupling.

## Daily TODO checklist - approved 2026-10-27

Verify create/edit/delete/cancel, checkbox completion and reopening, original order, required
title validation, title-only records, reload persistence, failed/stale writes, corrupt reminder
records, older documents, and progress counts (empty, mixed, all done) in both calendar views.
Verify that days off preserve TODOs and allow manual reminders; generation, copying, worklog
hours, logged counts, and CSV transfers remain independent. Check keyboard controls, dialog
focus/escape/discard behavior, and readable narrow-screen layout.

### Inline TODO interaction verification

Verify Worklog/TODO tab selection and arrow/Home/End keys; worklog drafts survive tab changes.
Check calendar TODO counts open the correct tab. Test inline title edits, no save within a
row, click-out/Tab saves, blank-title errors, new-item completion, failed/stale saves retaining
text, close/discard handling, deletion cancellation/failure, and checkbox rollback.

Verify that title-only TODOs create, edit, complete, reopen, delete, autosave and reload. Legacy
notes must be omitted from loaded and newly persisted records while preserving all remaining
TODO fields and existing worklogs. Failed writes must leave original stored data untouched.
