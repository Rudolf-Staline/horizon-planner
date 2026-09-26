begin;

comment on table public.planner_snapshots is
  'Legacy Horizon planner snapshot bridge. Runtime planner reads and writes use normalized tables as of 2026-09-26. Retained temporarily for rollback/audit only.';

commit;
