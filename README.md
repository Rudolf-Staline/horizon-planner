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
- Contextual collision detection after move, resize, or creation
- Non-blocking conflict bar
- Suggested next free slot for flexible tasks
- Undo / redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`)
- Local persistence via `localStorage`
- **Maintenant** execution view
- Responsive mobile fallback
- `prefers-reduced-motion` support

## Stack

- React
- TypeScript
- Vite

## Run locally

```bash
npm install
npm run dev
```

## Architecture

- `src/domain/` — planner types, constants, seed data, scheduling rules
- `src/state/` — local state, history, and persistence boundary
- `src/components/` — UI and interaction components
- `src/hooks/` — pointer interaction logic
- `src/utils/` — time calculations

The state layer is intentionally isolated so it can later be replaced by Supabase + TanStack Query without rewriting the calendar UI.

## Next production steps

1. Constraint-based flexible-task scheduling engine
2. Scheduling windows, deadlines, locked events, and task splitting
3. Natural-language task parser
4. Supabase schema, auth, and sync
5. Project / task / routine views sharing the same domain model
6. Mobile day-first interaction model
7. Automated tests for scheduling and interaction invariants
