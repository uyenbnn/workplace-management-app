# Product overview

[← Specification index](worklog-mvp-spec.md)

Version: 0.3 · Updated: 2026-10-26 · Requirements draft

Confirmed requirements and proposed decisions retain their original labels. Original section numbers are preserved for reference.

## 1. Product purpose

A personal website for managing workplace activity and personal tasks. The first MVP helps one person maintain a daily worklog in a monthly calendar, with routine entries generated automatically and editable through pop-ups.

The long-term application has two main tabs: **Workplace** and **Personal**. This specification implements only **Workplace → Worklog tracker**. “Work tab” in the original brief means Workplace throughout this document.

## 2. Source of requirements

- The user's written brief is the source of product requirements.
- `Primitives.tokens.json`, `Tokens-Light.tokens.json`, and `Mobile.tokens.json` are design reference data, not application behavior instructions.
- Requirements marked **Confirmed** come from the brief. Items marked **Proposed** resolve gaps for review and are not approved requirements.
- Angular 22 is the requested implementation target. Framework availability and dependency compatibility must be checked when implementation begins.

## 3. Goals and scope

### Confirmed MVP scope

- Monthly calendar inspired by a Notion database calendar, with previous/next month navigation.
- Workdays are Monday through Friday.
- Automatically create two work items per eligible day: one Meeting and one Work on task.
- Backfill missed weekdays when the app is reopened.
- Copy yesterday's task into the next day's default task.
- `timeLog = true` means the time has been logged in another system.
- Allow the user to mark a date as a day off; no items are created on that date.
- Manually create additional work items.
- Click a calendar day to open a pop-up for creating, editing, and deleting its worklog items.
- Edit generated entries, including the default one-hour meeting duration.
- Persist data in local storage for the first MVP.
- Clean, modern visual design using Unbounded and Albert Sans.
- Angular 22 with reusable components.

### Deferred

- Personal task functionality and other Workplace subtabs.
- Firebase integration, authentication, database, and hosting deployment for this MVP. Firebase Hosting is the intended future hosting target.
- Cross-device synchronization, collaboration, external issue trackers, external time logging, reporting, and notifications.
- Drag-and-drop scheduling, recurring-item configuration, holiday calendars, and alternate calendar views unless subsequently requested.

### Proposed success criteria

A user can open the app, find today's two default entries on an eligible workday, adjust them, add an entry, and reload without losing saved changes. Reopening the app backfills missed workdays, copies task details forward, respects days off, and never duplicates defaults or restores deliberately deleted entries.

## 4. Intended user and navigation

Primary user: an individual maintaining their own daily work history.

Proposed navigation:

```text
Application
├── Workplace
│   └── Worklog tracker [MVP]
└── Personal [future]
```

Open directly to Workplace → Worklog tracker and the current month. Display Personal as a clearly labeled future feature; do not present an empty functional task manager.

## Personal skeleton - approved 2026-10-28

Enable the Personal navigation tab and open a dedicated skeleton page at `/personal`.
The page contains a Personal heading and a coming-soon message only. Personal task
functionality remains deferred. Workplace / Worklog remains the default entry route.
This supersedes the earlier disabled Personal navigation requirement.
