# Horizon data model

The calendar UI must not become the database model.

## Normalized domain

- `profiles` — user display/timezone preferences.
- `projects` — containers for related work.
- `tasks` — work definitions: title, duration, category, priority, fixed/flexible semantics.
- `task_constraints` — deadline, daily admissible window, energy preference and split policy.
- `routines` — recurrence templates.
- `calendar_events` — external or manually fixed time blocks.
- `planned_segments` — actual placements produced for a task or routine.

A long flexible task may therefore have one `tasks` row and several `planned_segments` rows.

## Why constraints are separate

The scheduling engine consumes constraints but does not need to know how they are persisted. Keeping them separate from the task record also leaves room for richer constraint sets later without bloating every task row.

## Transitional snapshot

`planner_snapshots` is intentionally temporary.

The current prototype stores a flat `PlannerEvent[]`. The snapshot table gives that prototype atomic cloud persistence while the CRUD surfaces for projects/tasks/routines are introduced. It should not become the final source of truth.

Migration path:

1. current UI reads/writes the snapshot;
2. normalized CRUD screens are added;
3. calendar projection is assembled from `calendar_events + planned_segments + tasks`;
4. snapshot reads are removed;
5. snapshot table can eventually be dropped in a dedicated migration.

## Security

Every user-owned table has RLS enabled.

Policies only allow a signed-in user to read or mutate rows whose `user_id` equals `auth.uid()`. `profiles` uses the profile primary key itself as the ownership key.

No service-role key belongs in the browser.
