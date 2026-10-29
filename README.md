# Workplace · Worklog MVP

An Angular 22 application for an individual daily worklog. Open Workplace → Worklog tracker to review a Monday-first monthly calendar, edit meetings and tasks, record external logging, and manage days off.

## Run locally

Use Node **24.15.0 or newer in the 24.x line**, or another supported version from `package.json`. The original machine runtime (24.12.0) is too old for Angular 22. Verification used Node 24.15.0 without replacing the system installation.

```powershell
npm ci
npm start
```

Open `http://localhost:4200/`. Keep the same origin and browser profile to retain local data.

## Verification

```powershell
npm run format:check
npm run build
npm test -- --watch=false
```

Tests cover date boundaries, backfill, copying, deleted defaults, days off, validation, schema recovery, revision conflicts, failed saves, and date rollover. No lint tooling is configured.

## Behavior and data

- First use begins generation today. Each eligible weekday receives a 1-hour Meeting and a task. Reopening backfills missing weekdays; focus and local date rollover also reconcile.
- Tasks carry forward from the most recent eligible weekday, including completed tasks. Copies are independent and reset duration and logged state.
- Deleting defaults does not recreate them. Marking a populated date off requires confirmation and permanently removes its entries. Removing day off can create fresh defaults.
- Manual entries are allowed on past, future, and weekend dates unless marked off. A saved task needs a name; story ID and points are optional.
- Data stays in `localStorage` under `worktask.worklog.v1`. Clearing browser data removes it. Other browsers, origins, and ports have separate data. Export/import and remote persistence are deferred.
- Damaged or unsupported data is preserved and shown as an error. Correct the stored data or restore it externally, then choose Reload worklog. There is no automatic reset.
- Other tabs refresh when idle and stale saves are rejected. localStorage cannot guarantee simultaneous-write safety across tabs; edit in one tab at a time.
- Personal, Firebase, authentication, external integrations, and deployment are deferred.

## Structure and design

`src/app/features/worklog` separates page orchestration, UI, domain rules, and persistence. Presentation components emit typed intent; the store uses a replaceable repository interface. Dialogs use Angular CDK.

Global CSS variables derive from the three supplied files in `references/`. Rebuild token styles with `node tools/build-tokens.cjs`, then format them. Additional layout tokens are documented in `src/styles/_base.scss`. Fonts load once from Google Fonts with local fallbacks.

Requirements and approved decisions are indexed in [docs/worklog-mvp-spec.md](docs/worklog-mvp-spec.md).

Time spent is entered and displayed in hours, including fractions such as 0.5 and 1.5. Existing local data retains its equivalent duration.

Changing a task status synchronizes every occurrence with the same non-empty story ID (trimmed, case-sensitive). Other fields remain specific to each worklog.
