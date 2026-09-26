/**
 * Legacy snapshot bridge retained temporarily for database rollback only.
 *
 * Horizon no longer reads from or writes to planner_snapshots at runtime.
 * The normalized tables (tasks, task_constraints, planned_segments and
 * calendar_events) are now the planner source of truth.
 */
export const LEGACY_PLANNER_SNAPSHOT_TABLE =
  'planner_snapshots'
