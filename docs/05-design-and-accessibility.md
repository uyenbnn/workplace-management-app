# Design and accessibility

[← Specification index](worklog-mvp-spec.md)

Version: 0.3 · Updated: 2026-10-26 · Requirements draft

Confirmed requirements and proposed decisions retain their original labels. Original section numbers are preserved for reference.

## 12. Design direction and tokens

The favicon uses the header's white “w.” logo on the primary pink rounded square. Its SVG contains
outlined Unbounded lettering so it works without web fonts; a multi-size ICO provides a fallback.

Use the supplied files as the foundation rather than inventing an unrelated palette. They provide primitives, semantic light-theme colors, and mobile typography. Token metadata is reference information.

| Purpose         | Supplied token                            | Value                   |
| --------------- | ----------------------------------------- | ----------------------- |
| Page background | `color/background/default`                | `#FCFCFD`               |
| Surface         | `color/surface/default`                   | `#FFFFFF`               |
| Subtle surface  | `color/surface/subtle`                    | `#FAFBFC`               |
| Primary text    | `color/text/primary`                      | `#444140`               |
| Heading text    | `color/text/heading`                      | `#292726`               |
| Secondary text  | `color/text/secondary`                    | `#666260`               |
| Default border  | `color/border/default`                    | `#D9DDE4`               |
| Primary action  | `color/action/primary/background/default` | `#E4007C`               |
| Focus ring      | `color/focus/ring`                        | `#C20069`               |
| Heading family  | `typography/family/heading`               | Unbounded               |
| Body family     | `typography/family/body`                  | Albert Sans             |
| Body medium     | `typography/body/md`                      | 16px / 24px, weight 400 |
| Medium label    | `typography/label/md`                     | 14px / 20px, weight 600 |

Proposed visual direction: neutral calendar surfaces, fine borders, generous spacing, restrained pink accents for primary actions and selection. Keep Unbounded for concise headings and Albert Sans for dense calendar content, forms, and navigation. Preserve semantic hover, disabled, focus, and feedback colors from the tokens.

Desktop typography, spacing, radii, elevation, and layout values not specified by these references need explicit implementation-level choices. Validate text contrast and control readability in the actual composed interface.

## 13. Accessibility and states

Successful item saves and confirmed deletions show a success toast above the editor for four seconds.
Repeated actions replace the previous toast and restart its timeout. Toasts do not move focus or block
controls; CDK announces them politely to screen readers, including inside dialogs. Failed actions keep
their inline errors and never show a success toast.

Approved UI update: action buttons use the shared pill radius, including calendar navigation,
add/save/cancel/delete actions, and dialog controls. Clickable work-item cards retain the control
radius to support their multi-line content. Inputs and dialog surfaces retain their existing shapes.

Calendar cells highlight on hover and focus within. A plus affordance in the date button opens the
day's worklog; it appears on hover or keyboard focus and stays visible on touch devices. Days off
retain their management action without showing an add affordance. Reserved icon space prevents layout shifts.

The selected-day border is shown only while its dialog is open. Closing the dialog, including by
clicking outside, clears the selection; keyboard focus indicators remain available.

Proposed requirements:

- All calendar dates, cards, month controls, and form actions are keyboard accessible with visible focus.
- Calendar date controls expose their full date and item count to assistive technology.
- Dialog has an accessible name, moves focus inside on opening, contains keyboard focus, and returns focus to the triggering control on close.
- Escape follows the same unsaved-change protection as Close.
- Inputs have labels; errors and save feedback are announced accessibly.
- Status and logged state include text or icons with accessible labels, not color alone.
- Pop-up content scrolls on small screens without hiding save/cancel actions.
- Cover normal, empty day, weekend, day off, overflow, invalid input, save failure, and corrupted-data states.

## Material icons — approved 2026-10-27

Use Google Material Symbols Outlined for navigation chevrons, local-device indication, add,
close, and success/logged icons. Load the icon font once in the document head and define its
rendering class globally. Decorative symbols are hidden from assistive technology; icon-only
buttons retain descriptive accessible labels. Keep textual status labels alongside status icons.
Store edited sources as UTF-8; use HTML entities or escaped Unicode for punctuation where useful.

## Calendar view toggle — approved 2026-10-27

Present Month and Work week as two equal segments within one pill-shaped track, with a light
sliding pill marking the active view. Use the existing app palette, retain native button semantics
and pressed states, preserve visible keyboard focus, and disable sliding motion when reduced
motion is requested. The reference image establishes layout, not its blue colors or Photo/Video labels.

## Scroll areas and dialog actions - approved 2026-10-27

Worklog Save/Cancel actions follow the form fields in normal document flow so they never
cover duration, logged-state controls, hints, or errors. Dialog content areas shrink and scroll
within their available height while separate headers and footers retain their space. Use thin
scrollbars throughout the app, including dialogs and nested scroll areas, with existing semantic
colors and a 6px fallback for older browsers. Preserve native high-contrast scrollbar colors.

The day-dialog Worklog/TODO tabs share the calendar view switch appearance: neutral pill
track, sliding white indicator, primary active text, equal segments, and reduced-motion support.
The dialog switch spans its panel width and retains accessible tab keyboard behavior.

The day-off toggle sits in the day-dialog header immediately left of Close. Remove the
separate work-item count row. Keep the two header actions together when the header wraps
on narrow screens; retain day-off confirmation and work-item selection counts.

## Header navigation - approved 2026-10-28

Center the desktop navigation between equal outer header columns. Use a visible neutral pill track with two equal segments and a sliding indicator,
primary pink Workplace pill with white text and icons, decorative Google Material Symbols Outlined work/person icons, and a disabled
Personal destination with inline Coming later text (visually hidden on narrow screens, retained in the accessible name). Keep native route link/button semantics and
route-derived current-page indication. Animate the active background with a brief slide/fade
on entrance and subtle hover/press feedback; disable nonessential motion for reduced motion.
Keep the header transparent with top padding and a primary pink horizontal line underneath, spanning only the header content width. On narrow screens retain the brand mark and center navigation in the remaining space.

Header and worklog content share the same maximum width and responsive horizontal gutter.
Align the brand, header divider, page heading, and calendar to the same left edge; align the
workspace label, divider end, and page actions/calendar to the same right edge.
