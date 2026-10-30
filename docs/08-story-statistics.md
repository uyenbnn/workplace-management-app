# Workplace story statistics — approved 2026-10-30

The approved statistics feature supersedes the deferral of other Workplace subtabs and reporting
for this read-only view only. Add `/workplace/statistic` with shared Workplace navigation.

- Aggregate `WORK_ON_TASK` entries only, across all statuses and external logging states by
  default. Independent copied entries each contribute their recorded time. Meetings and daily
  TODO reminders are excluded.
- Sum existing schema-v1 `timeSpent` values in minutes and convert to hours without rounding
  individual entries. Display up to two decimal places. Keep zero-hour groups. The existing
  repository rejects missing or invalid stored durations; do not relax validation or migrate data.
- Trim story IDs, group case-insensitively, and display uppercase IDs. Blank IDs form a
  **No story ID** group. This normalization is for reporting only; existing case-sensitive
  shared-status editing rules remain unchanged.
- Search story ID and task name using trimmed, case-insensitive substring matching. Apply
  search and filters before grouping, so totals include exactly the expanded matching entries.
- Default to the current local calendar month. Offer current month, previous month, all time,
  and custom inclusive date ranges. Require both endpoints for custom ranges and show errors
  for invalid or reversed ranges.
- Filter by multiple statuses (OR within status, none selected means all) and timeLog
  (all/logged/not logged). Combine search and different filters with AND.
- Show matching hours, story-group count, and task-entry count. Provide an expandable table
  with story ID, hours, and count. Default to hours descending with ascending story ID ties;
  offer ascending/descending sorting by story ID, hours, and count.
- Expanded entries show local date, task name, hours, textual status, and external logging
  state, ordered by date descending then stable ID ascending. Use Untitled task for placeholders.
- Reset restores current-month defaults and collapses details. Filters are not persisted.
- Distinguish no saved tasks, no matches, and storage failures. Retry reads without writing.
  Hide stale totals on read failure. Preserve corrupt storage unchanged.
- Opening, reloading, focusing, and filtering statistics must never generate defaults, backfill,
  or write storage, including after visiting Worklog tracker. Refresh reads on entry, focus,
  visible-tab return, and relevant storage events. Resume worklog generation when returning to
  Worklog tracker.
- Use semantic tokens, labeled native controls, visible focus, keyboard expansion with
  aria-expanded/aria-controls, and responsive details exposing every field at narrow widths.

No chart, export, editing, new duration field, backend, or storage migration is included.

## Underline navigation — approved 2026-10-30

Use the supplied prototype's understated navigation style for Worklog tracker and Statistics:
two equal-width route links above a thin neutral baseline, with a primary-color underline
sliding between the active destinations. Include decorative Material calendar_month and
bar_chart icons beside the respective labels. Preserve native links, route-derived current-page
state, visible keyboard focus, and readable labels on narrow screens. Disable transitions for
reduced motion. Keep the navigation mounted in the app shell across Workplace route changes
so the underline slides continuously; hide it on Personal. Retain the app's semantic palette.

Verification covers normalized/missing IDs, task-only inclusion, fractional-hour totals,
independent copies, zero duration, date/month/year boundaries, filter combinations, sorting,
detail ordering, matching summaries, refresh, corrupt/unavailable storage, no writes or generation,
navigation, reset, reload defaults, keyboard operation, and narrow screens.

## Column sorting and filtering � approved 2026-10-30

This refactor supersedes the status/logged toolbar filters and standalone sort selector above.
Keep only global search, inclusive dates, and Reset in the toolbar. The grouped table retains
Story ID, Hours, Entries, and read-only expandable task details.

- Filter task records by global search and dates, then aggregate, filter grouped rows, and sort.
  The summary describes visible groups and their contributing task entries.
- Clicking a header label selects its column; repeat clicks reverse the direction. Only one
  sort is active. Default Hours descending; newly selected Story ID starts ascending and
  Hours/Entries start descending. Numeric ties use Story ID ascending.
- Separate header filter icons open anchored CDK popovers. Story ID uses trimmed,
  case-insensitive substring matching against the displayed ID, including No story ID.
  Hours and Entries use optional inclusive minimum/maximum ranges, combined with AND.
  Compare unrounded hours; accept nonnegative decimals for hours and integers for counts.
- Valid changes apply immediately. Invalid numeric drafts remain visible with an inline error
  while the last valid range for that column remains applied. Clearing removes the draft,
  error, and applied filter. Opening another column closes the current popover.
- Escape, Close, or clicking outside closes the popover without undoing applied changes.
  Move focus into it on open, contain keyboard focus, and restore the trigger on close.
  Show active-filter indicators, native header buttons, aria-sort, and accessible labels.
- Keep column controls visible when no rows match. Preserve expanded story IDs when sorting
  or filtering. Reset clears every filter, restores the current month and Hours descending,
  and collapses details. Filters/sort remain temporary and reset on reload.
- Extract a typed worklog presentation component without repository access or aggregation.
  Use semantic tokens and horizontal table scrolling on narrow screens. Expanded entries
  retain date-descending/ID-ascending order and textual status/logged details.

Verify combined aggregate filters, numeric validation and ties, missing IDs, summaries, reset,
expansion retention, empty-result recovery, focus/Escape/outside clicks, and no storage writes.
No new columns, pagination, table library, backend, or storage migration is included.

## Remove the toolbar card � approved 2026-10-30

Remove the entire global search/date/reset card and its page-level state. Statistics now
includes all saved task dates; there is no hidden current-month restriction. Sorting and
filtering remain available through the three column headers. Clear each column in its popover;
there is no global Reset action. Column filters and sorting still reset on page reload.
This supersedes the earlier toolbar, global-search, and default date-range requirements.
