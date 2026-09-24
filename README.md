# Horizon Planner

Interactive prototype of **Horizon**, a personal planning app focused on fast manipulation, visual clarity, and contextual replanning.

## Current prototype

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
- Local persistence via `localStorage`
- **Maintenant** execution view
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

## Next production steps

1. Natural-language task parser
2. Persistent projects/tasks/routines domain model
3. Supabase schema, auth, and sync
4. Mobile day-first interaction model
5. Calendar accessibility and keyboard interactions
6. Broader tests for state history and pointer interactions
