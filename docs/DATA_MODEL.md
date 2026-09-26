# Horizon data model

The calendar UI is a projection of the domain, not the database model.

## Authoritative normalized domain

- `profiles` — user display and timezone preferences.
- `projects` — containers for related work.
- `tasks` — logical work definitions: title, duration, category, priority and fixed/flexible semantics.
- `task_constraints` — deadline, daily admissible window, energy preference and split policy.
- `routines` — recurrence templates.
- `routine_exceptions` — per-date skips or overrides for a routine.
- `calendar_events` — manually fixed or external time blocks.
- `planned_segments` — concrete placements for tasks or routines.

A long flexible task therefore remains one `tasks` row even when it is represented by several `planned_segments` rows.

## Runtime source of truth

Authenticated planner startup reads the normalized Supabase model and reconciles it with the user-scoped local cache. The local cache supports local-first continuity; it is not a second shared cloud model.

Planner writes are projected to the normalized tables. Existing rows are upserted first and only stale task segments or manual calendar rows are deleted afterward.

## Constraints

The scheduling engine consumes constraints without depending on their persistence format. Keeping `task_constraints` separate from `tasks` leaves room for richer planning rules without bloating every logical task row.

## Legacy snapshot table

`planner_snapshots` is no longer read, written or surfaced by Horizon at runtime.

One historical row is currently retained in the database solely as a short-lived rollback/audit artifact from the former flat `PlannerEvent[]` bridge. It is not part of the admin product metrics or the current synchronization path. The table should only be dropped through a dedicated migration after the rollback window has intentionally ended.

Historical migrations still mention the table because migrations are immutable records of how the schema evolved.

## Security

Every user-owned table has Row Level Security enabled.

Policies only allow a signed-in user to read or mutate rows whose ownership key matches `auth.uid()`. `profiles` uses the profile primary key itself as the ownership key.

No service-role key belongs in the browser. Privileged administrative operations run only in the authenticated `admin-api` Edge Function.
