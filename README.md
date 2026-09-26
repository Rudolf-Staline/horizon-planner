# Horizon Planner

**Horizon** is a personal planning application focused on fast manipulation, visual clarity, authenticated multi-user data, and contextual replanning.

## Current prototype

- Real-date calendar with Day / Week / Month / Year navigation
- Current-time **Maintenant** execution mode
- Week calendar with opaque saturated event cards
- No times rendered inside calendar cards
- Pointer drag & drop across days and time slots
- 15-minute snapping
- Bottom-handle resize
- Quick creation from an empty slot
- Fixed vs flexible tasks
- Constraint-aware automatic planning
- Daily scheduling windows
- Deadlines
- Energy-aware slot scoring
- Optional task splitting
- Locked-event support
- Contextual collision detection after move, resize, or creation
- Non-blocking conflict bar
- Suggested free slot for flexible tasks
- Undo / redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`)
- Account-scoped local persistence + Supabase cloud sync
- Password authentication and admin console
- Responsive mobile day-first calendar
- Keyboard calendar manipulation (move with arrows, resize with Shift+arrows)
- `prefers-reduced-motion` support
- Vitest coverage for scheduling invariants

## Stack

- React
- TypeScript
- Vite
- Vitest

## Run locally

```bash
npm install
npm run dev
```

Run the planning-engine tests:

```bash
npm test
```

## Architecture

- `src/domain/` — planner types, scheduling constraints, scoring and pure domain rules
- `src/state/` — local state, history, conflict state, persistence boundary
- `src/components/` — UI and interaction components
- `src/utils/` — time calculations
- `docs/` — product/engine contracts that should remain independent from UI implementation

The state layer is intentionally isolated from the UI. Authenticated cloud persistence already uses the normalized Supabase model, while the browser keeps a user-scoped local cache for local-first continuity.

## Planning principle

Horizon separates three ideas:

- **fixed** — the automatic planner does not move the item
- **locked** — direct calendar gestures cannot move or resize the item
- **flexible** — Horizon may propose or compute a placement inside explicit constraints

Automatic planning never mutates an existing user schedule silently. It returns a proposal; the UI decides when that proposal becomes state.

See `docs/PLANNING_ENGINE.md` for the v1 engine contract.

## Remaining product work

1. Retire the legacy snapshot table after a stability window


## Supabase

Horizon uses Supabase for authenticated cloud sync while remaining local-first.

The production Vite bundle uses only public browser configuration:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No service-role key is used or committed.

The schema is versioned in `supabase/migrations/` and Row Level Security is enabled on every user-owned table.


### Normalized planner persistence

Authenticated planner state is persisted in the normalized Supabase domain:
`tasks`, `task_constraints`, `planned_segments`, and `calendar_events`.
The historical `planner_snapshots` table is not part of runtime synchronization; its remaining backup row is retained temporarily only for rollback/audit.


### Projects and routines

Projects and routines are now first-class Supabase entities. Tasks can be assigned to a project, and active routines are expanded into virtual calendar occurrences for the visible date range without duplicating recurring rows.


### Task inbox

Tasks can now exist without an immediate calendar placement. The Tasks screen has a real inbox backed by `tasks.status = 'open'`; a task can later be scheduled into the calendar while preserving project, priority, duration, and deadline metadata.


### Multi-segment task identity

A logical task now has an explicit `taskId`, while each calendar placement keeps its own segment `id` and `segmentIndex`. Multiple scheduled blocks therefore persist as one row in `tasks` plus multiple rows in `planned_segments`, instead of being duplicated into separate tasks.


### Routine exceptions

A recurring routine can now be skipped or overridden for a single date without changing the whole series. Exceptions are stored in `routine_exceptions` and applied when routine occurrences are projected into the visible calendar range.


### Normalized source of truth

Planner startup now reconciles only the normalized Supabase model with the per-user local cache. Newer local changes can be pushed back to the normalized tables, while a failed cloud read is never treated as permission to overwrite remote state. The former `planner_snapshots` bridge is no longer part of runtime synchronization.


### Targeted normalized synchronization

Planner persistence now upserts current tasks, segments, constraints and manual calendar events before deleting only stale rows. This avoids the former delete-all/reinsert window and preserves an existing task completion timestamp when an already-completed task is synchronized again.


### Per-user admin data inspection

Administrators can inspect application-level counts and recent task/project records for a selected user through the authenticated `admin-api` Edge Function. Authentication secrets and raw SQL remain outside the browser interface.


### Confirmation email resend

The signup flow uses a neutral confirmation message and offers an explicit resend action when email verification is pending. Existing confirmed accounts are directed toward normal sign-in or password recovery rather than being told that a new account was certainly created.


### Deterministic dependency graph

Top-level npm dependencies are pinned to exact validated versions and the full transitive graph is committed in `package-lock.json`. CI installs exclusively with `npm ci`, so a third-party package release cannot silently change a Horizon build.


### Mobile navigation and touch scheduling

Small screens now keep all primary product sections reachable through a persistent bottom navigation. The day calendar adapts its column width to the viewport, empty time slots can be created with a touch, touch resize handles stay discoverable, and non-functional header placeholders were removed.


### Flexible is behavior, not a category

`flexible` now exists only as a scheduling `kind`. Domain categories are limited to course, project, personal, focus, routine, admin and neutral. Legacy planner events using `category = flexible` are migrated to `neutral` while preserving their flexible scheduling behavior.


### Date-aware natural-language planning

Natural-language commands now resolve tomorrow, named weekdays and weekday deadlines to concrete ISO dates. The scheduling engine can place work across week boundaries when a concrete deadline allows it, instead of clamping every request to the current Monday-Sunday grid.


### Date-based Quick Create deadlines

Quick Create now stores a concrete ISO deadline date for flexible work instead of constraining deadlines to the remainder of the current week. The scheduling engine can therefore propose placements across week boundaries consistently with natural-language planning.


### Editable task planning constraints

The task detail panel now edits the same constraints consumed by the planner: concrete deadline date, daily time window, energy preference, splittability and minimum chunk size. Task-level constraint changes propagate across all scheduled segments and persist through `task_constraints`.


### Calendar overlap lanes

Overlapping events on the same date are assigned deterministic visual lanes. Connected overlap groups share the minimum number of lanes required, while non-overlapping events keep the full day-column width.


### Drag edge auto-scroll

Calendar drag gestures now account for the calendar container scroll offset. Moving a captured card near a vertical or horizontal viewport edge scrolls the grid progressively while preserving 15-minute and day-column gesture calculations.


### Planner flow integration tests

Domain-level integration tests now cover complete planning flows: natural-language parsing on a Sunday, scheduling across a week boundary, multi-day splitting under narrow daily windows, fixed-appointment exclusion, and the separation between semantic category and flexible scheduling behavior.


### Lexical category boundaries

Natural-language category inference now uses explicit word boundaries so short tokens such as `app` and `cours` do not accidentally classify unrelated verbs such as `appeler` or `courir`.


### Tested task mutations

Logical task completion and deletion are now pure domain operations rather than hook-local array manipulation. Tests cover completing/reopening every segment, deleting one segment with deterministic reindexing, deleting an entire logical task, preserving unrelated tasks, and missing-target no-ops.


### Conservative adaptive replanning

Conflict suggestions now distinguish movable flexible work from fixed commitments. A conflicting flexible task can be proposed for relocation while a fixed event stays in place. Fixed/fixed conflicts and ambiguous cases with several movable conflicts deliberately produce no automatic choice; the user keeps final control through an explicit Apply action.


### Task-aware Now mode

Now mode understands multi-segment tasks. It shows the active block position, task-level completion percentage and completed/total duration, while keeping separate actions for finishing the current block or the entire logical task.


### Tested calendar gestures

Pointer move and resize geometry is now a pure tested utility. Coverage includes 15-minute snapping, day-column movement, accumulated vertical and horizontal scroll, calendar-bound clamping, minimum resize duration and the 22:00 end boundary. The React event card delegates gesture math to this shared contract.


### User-scoped local cache contract

Local planner persistence is now isolated behind a tested storage contract. Cache keys include the authenticated user id, current schema envelopes are validated before use, malformed or stale-version JSON is rejected, and reconciliation tests explicitly cover equal timestamps, local-only recovery and cloud-read failures without accidental pushes.


### Tested normalized persistence mapping

Projection from planner events to Supabase rows is now a pure tested layer. Multi-segment work produces one logical task row plus multiple planned segments, flexible constraints are written once per task, completion timestamps are preserved, fixed tasks are identified for constraint cleanup, manual calendar events stay separate, and virtual routine occurrences are never persisted as manual planner data.


### Legacy snapshot isolation

The former `planner_snapshots` bridge has no runtime module, no admin metric and no synchronization path. Its single historical database row is retained only as a temporary rollback/audit artifact until the stability window is deliberately closed.


### Inline calendar quick create

Empty day/week slots now create in place instead of opening a modal. Hover reveals the target slot, one click inserts a focused draft at that time, Enter commits a minimal flexible task, and Escape cancels it. The created task deliberately starts neutral with a 60-minute duration and a concrete J+2 deadline; richer constraints stay in the detail panel.


### Browser-level smoke coverage

CI now launches Horizon in Chromium with Playwright. The browser suite verifies that the public entry keeps the planner locked when cloud configuration is absent and exercises the real calendar UI for inline create/commit/cancel behavior without using an authentication bypass or storing test credentials.


### Neutral untimed planning

Natural-language tasks without an explicit clock constraint no longer inherit a hidden 15:00 bias. Future-date commands begin from the planner day boundary, while same-day commands can still use the current rounded time as their context. Explicit times and windows continue to override this neutral default.


### Real pause semantics in Now mode

The Pause action now controls a real local execution timer instead of only changing button text. Pausing freezes the remaining execution time, resuming continues from that frozen value, and the running session can remain focused after its original calendar window ends. This execution timer never mutates or silently shifts the schedule.


### Date-true weekly analytics

The analytics screen now measures only the real current Monday-Sunday interval using each event's ISO date. It no longer relies on the obsolete May 2024 weekday labels or counts future weeks as current workload, and an empty week no longer invents a “busiest” day.


### Future-safe same-day planning

Same-day natural-language planning now rounds the current clock forward to the next 15-minute slot. A command entered at 12:07 therefore starts from 12:15 rather than silently considering 12:00, preventing new work from being proposed in the past.


### Prototype seed removal

The obsolete hard-coded demo schedule has been removed. Horizon no longer carries personal sample events or a May-2024-era seed layer in the runtime repository; planner state now comes from authenticated normalized data, the user-scoped local cache, and explicit user actions.


### Single calendar gesture implementation

The unused legacy `useEventGesture` hook has been removed. Calendar pointer geometry now has one implementation only: the tested pure helpers in `src/utils/pointer.ts`, used directly by `EventCard`.
