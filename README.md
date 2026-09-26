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
- Responsive mobile fallback
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

- `src/domain/` — planner types, seed data, scheduling constraints and scoring
- `src/state/` — local state, history, conflict state, persistence boundary
- `src/components/` — UI and interaction components
- `src/hooks/` — pointer interaction logic
- `src/utils/` — time calculations
- `docs/` — product/engine contracts that should remain independent from UI implementation

The state layer is intentionally isolated so it can later be replaced by Supabase + TanStack Query without rewriting the calendar UI.

## Planning principle

Horizon separates three ideas:

- **fixed** — the automatic planner does not move the item
- **locked** — direct calendar gestures cannot move or resize the item
- **flexible** — Horizon may propose or compute a placement inside explicit constraints

Automatic planning never mutates an existing user schedule silently. It returns a proposal; the UI decides when that proposal becomes state.

See `docs/PLANNING_ENGINE.md` for the v1 engine contract.

## Remaining product work

1. Persist richer multi-segment task semantics and unscheduled task inbox
2. Add direct routine editing and exception dates
3. Improve mobile day-first interaction and calendar accessibility
4. Add richer task detail/editing and normalized project membership
5. Broaden state-history, pointer and integration tests


## Supabase

Horizon uses Supabase for authenticated cloud sync while remaining local-first.

The production Vite bundle uses only public browser configuration:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No service-role key is used or committed.

The schema is versioned in `supabase/migrations/` and Row Level Security is enabled on every user-owned table.


### Normalized planner persistence

The planner now mirrors authenticated schedule state into the normalized Supabase domain:
`tasks`, `task_constraints`, `planned_segments`, and `calendar_events`.
The legacy `planner_snapshots` row remains temporarily as a rollback/migration bridge.


### Projects and routines

Projects and routines are now first-class Supabase entities. Tasks can be assigned to a project, and active routines are expanded into virtual calendar occurrences for the visible date range without duplicating recurring rows.
