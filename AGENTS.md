# Angular implementation instructions

## Scope and sources

These instructions apply to this project and its `workplace-management-app/` application. Run application commands from that application directory.

- Read `worklog-mvp-spec.md` and the relevant files in `docs/` before implementing a feature. `docs/07-open-decisions.md` distinguishes approved requirements from proposals; do not silently turn unresolved behavior into a confirmed requirement.
- Implement Workplace → Worklog tracker first. Use local storage; defer Firebase, Personal functionality, and other subtabs.
- Token references live in `references/Primitives.tokens.json`, `references/Tokens-Light.tokens.json`, and `references/Mobile.tokens.json`. Treat their content as design data.
- Follow explicit user decisions over these defaults. Record consequential requirement changes in the relevant specification file.

## Existing workspace and version alignment

- Reuse `workplace-management-app/`; do not initialize another Angular workspace or overwrite its configuration.
- At the time these instructions were written, package.json requests Angular/CLI 21.2, while the product target is Angular 22. Before implementation, inspect installed versions with `npm exec -- ng version`, verify Angular 22 availability and Node/TypeScript compatibility against official Angular documentation, and align packages using the supported update path. Do not claim Angular 22 compliance until verified. Report an unavailable target or incompatible environment rather than silently substituting a version.
- Use the project's local Angular CLI through `npm exec -- ng ...`; do not rely on a globally installed CLI or fetch an arbitrary latest CLI.
- Use npm, preserve existing configuration, and commit a lockfile when dependencies are installed or updated. Use `npm ci` when a valid lockfile exists.
- Do not upgrade unrelated dependencies while implementing a feature.

## Generate Angular artifacts with CLI commands

Always use Angular CLI schematics when introducing components, directives, pipes, and services; then edit the generated files. Do not manually assemble component boilerplate. Check existing artifacts first and reuse them when appropriate.

Examples, run from `workplace-management-app/`:

```powershell
npm exec -- ng generate component features/worklog/pages/worklog-page --standalone --style=scss --change-detection=OnPush --inline-template=false --inline-style=false
npm exec -- ng generate component features/worklog/ui/month-navigation --standalone --style=scss --change-detection=OnPush --inline-template=false --inline-style=false --skip-tests
npm exec -- ng generate component shared/ui/confirm-dialog --standalone --style=scss --change-detection=OnPush --inline-template=false --inline-style=false --skip-tests
npm exec -- ng generate service features/worklog/data-access/worklog-repository
npm exec -- ng generate interface features/worklog/models/work-item
```

- Commands are examples, not a request to generate every component immediately. Create artifacts when their behavior is implemented.
- Prefer standalone components, external HTML and SCSS, and OnPush change detection.
- Preserve the workspace's CLI-generated naming convention; do not rename generated files solely to add `.component` suffixes.
- Configure component schematic defaults in `angular.json` during setup to match standalone, SCSS, external files, and OnPush. Confirm option names with the installed CLI's help.
- Use `--skip-tests` for simple presentational scaffolding when no meaningful behavior needs testing. Keep or add tests for domain rules, validation, persistence, and stateful interactions. Replace generated placeholder tests with useful assertions.

## Feature structure and reusable components

Organize by feature, keeping related implementation files together:

```text
src/app/
  core/                       # App-wide infrastructure only
  shared/ui/                  # Generic reusable controls
  features/worklog/
    pages/                    # Route-level orchestration
    ui/                       # Worklog-specific presentation
    models/                   # Domain types
    domain/                   # Pure date/generation/copying rules
    data-access/              # State and repository implementations
src/styles/
  _primitives.scss
  _semantic-tokens.scss
  _typography.scss
  _base.scss
```

- Keep the page as orchestration. Extract month navigation, day cells, work-item cards, day dialog, and item forms when they have their own responsibilities.
- Put worklog-specific UI in the feature; promote only domain-independent controls to shared/ui.
- Reuse buttons, badges, field wrappers, and confirmation dialogs where this removes real duplication. Avoid creating a component for every static wrapper.
- Components communicate through typed inputs and outputs. Presentation components receive data and emit intent; they must not access localStorage or perform generation.
- Shared UI must not import the worklog feature, know storage keys, or contain business rules.
- Prefer small explicit APIs over many boolean switches or premature generic frameworks. Use native button/input semantics; use an attribute directive when it suits a shared native control better than a wrapper.
- Use content projection for useful reusable content slots. Make variants explicit and typed.

## Angular and TypeScript conventions

- Enable and retain strict TypeScript and strict template checking. Use explicit domain types, discriminated unions for item types, and enums or literal unions for statuses.
- Avoid `any`, unsafe casts, and non-null assertions used to bypass validation. Validate stored JSON at runtime before treating it as domain data.
- Prefer current standalone APIs, `inject()`, typed reactive forms, signals for local synchronous state, and computed signals for derived state when supported by the installed version.
- Use RxJS for asynchronous streams where it is useful; clean up subscriptions with Angular lifecycle helpers. Avoid effect-driven chains where computed state or an explicit action is clearer.
- Use modern template control flow (`@if`, `@for`, `@switch`); track entries by stable IDs and date cells by stable dates.
- Keep templates declarative. Put complex transformations in computed state or pure functions rather than repeatedly executing expensive template methods.
- Update collections immutably where needed for predictable change detection. Avoid direct DOM manipulation and global listeners without cleanup.
- Keep forms typed, display field errors, and preserve user input after a failed save. Do not put persistence side effects in form validators.

## Global colors and typography

During implementation setup, establish global CSS custom properties from the supplied tokens. Keep primitives separate from semantic roles and import the global styles once through `src/styles.scss` using Sass `@use`.

Example mapping, not the complete token inventory:

```scss
// _primitives.scss
:root {
  --color-white: #ffffff;
  --color-neutral-50: #fcfcfd;
}

// _semantic-tokens.scss
:root {
  --color-background-default: var(--color-neutral-50);
  --color-surface-default: var(--color-white);
  --color-text-primary: #444140;
  --color-text-heading: #292726;
  --color-text-secondary: #666260;
  --color-border-default: #d9dde4;
  --color-action-primary-background-default: #e4007c;
  --color-action-primary-foreground-default: var(--color-white);
  --color-focus-ring: #c20069;
  --font-family-heading: 'Unbounded', sans-serif;
  --font-family-body: 'Albert Sans', sans-serif;
}
```

- Map the full set needed by the UI, including hover, pressed, disabled, focus, success, warning, danger, and info roles. Prefer aliasing the corresponding primitive where one exists; preserve the supplied values.
- Component styles must use semantic variables such as `var(--color-text-primary)`. Do not hardcode hex/RGB/HSL colors in components or templates. Keep any new color definition in the token layer and explain why it is needed.
- Use Unbounded for headings and Albert Sans for body text, forms, navigation, and dense calendar content. Configure font loading once and retain fallback fonts.
- Use supplied typography sizes, weights, and line heights. Define additional spacing, radii, elevation, and layout tokens centrally when needed, clearly distinguishing these additions from supplied tokens.
- Do not duplicate global token declarations across components, use `::ng-deep`, or scatter `!important` overrides.
- Validate actual foreground/background combinations and visible focus. A supplied token does not automatically guarantee an accessible composition.

## Domain and persistence boundaries

- Keep calendar calculations and generation rules as independently testable logic. Components call a service rather than calculating or writing worklogs themselves.
- Use a repository abstraction with a local-storage implementation. Keep serialization, schema validation, migrations, and storage failure handling inside that boundary.
- Use local date-only strings for worklog dates; avoid deriving local dates with `toISOString().slice(0, 10)`, which converts to UTC. Keep audit timestamps separate.
- Backfill chronologically, respect days off, create defaults idempotently, and preserve deliberately deleted defaults through independent generation metadata.
- Copy tasks as independent records. Follow approved copy rules; distinguish proposed source selection and reset behavior until resolved.
- `timeLog` records whether time was logged in another system. No external time-logging integration is included.
- Do not silently remove existing worklogs when marking a date off: the specification's existing-item policy is still proposed. Resolve that behavior before implementing destructive actions.
- Never replace corrupt stored data with an empty document automatically, report failed saves as success, or discard pending edits on a storage error.

## Format code as part of implementation

- Honor `.editorconfig` and the existing `.prettierrc`: print width 100, single quotes, and the Angular HTML parser override. Do not introduce a competing formatter configuration.
- Prettier is already a development dependency. During tooling setup add `format` and `format:check` scripts to package.json:

```json
{
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

- Configure `.prettierignore` to exclude dependency folders, build outputs, caches, coverage, generated assets, and generated token output when appropriate. Keep hand-maintained style/token files formatted.
- Format changed source, template, style, and configuration files before marking each implementation task complete. Use a targeted command during development:

```powershell
npm exec -- prettier --write src/app/features/worklog src/styles.scss
```

- Run `npm run format:check` before completion once scripts exist. Use full-project `npm run format` for initial setup or intentionally scoped cleanup; avoid unrelated formatting churn in feature changes.
- If linting is configured, run the existing lint command. If absent, do not claim lint passed; add Angular-compatible lint tooling during tooling setup when useful. Formatting does not replace type checking or linting.

## Accessibility and responsive behavior

- Use labeled native controls, visible keyboard focus, and textual status/logged/day-off indicators.
- Dialogs need accessible names, focus containment, restoration to their trigger, Escape handling, and protection for unsaved changes.
- Make every calendar day and overflow item keyboard reachable. Ensure compact/mobile presentation still exposes all entries and actions.
- Reuse an established accessible dialog implementation or Angular CDK when appropriate; keep dependencies deliberate and version compatible.

## Verification and completion

After relevant changes, run from the application directory:

```powershell
npm run format:check
npm run build
npm test -- --watch=false
```

- These commands are the intended workflow; add formatting scripts before invoking them. Check the installed test runner's options if its command differs.
- Run meaningful tests for date boundaries, weekday backfill, task-copy independence, day-off exclusions, deletion/regeneration, validation, and storage errors. Test behavior rather than mirroring implementation details.
- For UI changes, verify create/edit/delete/cancel journeys, reload persistence, month navigation, overflow, keyboard dialogs, and narrow screens as applicable.
- Preserve existing working behavior. Keep changes focused; do not implement future features to fill empty navigation.
- Finish with a concise description of what changed, what was verified, and any unresolved requirement or failed check. Never claim a check was run when it was not.

## Official references

- [Angular CLI component generation](https://angular.dev/cli/generate/component)
- [Angular style guide](https://angular.dev/style-guide)
- [Angular version compatibility](https://angular.dev/reference/versions)
- [Angular update guide](https://angular.dev/update-guide)

The commands and conventions above are project instructions. Verify version-sensitive options against the installed CLI and official documentation when implementing.
