begin;

-- The auth trigger needs SECURITY DEFINER, but it must not be exposed as an RPC.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

-- Cover owner-aware composite foreign keys.
create index if not exists tasks_project_owner_idx
  on public.tasks(project_id, user_id)
  where project_id is not null;

create index if not exists constraints_task_owner_idx
  on public.task_constraints(task_id, user_id);

create index if not exists routines_project_owner_idx
  on public.routines(project_id, user_id)
  where project_id is not null;

create index if not exists calendar_events_project_owner_idx
  on public.calendar_events(project_id, user_id)
  where project_id is not null;

create index if not exists planned_segments_task_owner_idx
  on public.planned_segments(task_id, user_id)
  where task_id is not null;

create index if not exists planned_segments_routine_owner_idx
  on public.planned_segments(routine_id, user_id)
  where routine_id is not null;

-- Recreate RLS policies with auth.uid() evaluated once per statement.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
on public.projects for select
using ((select auth.uid()) = user_id);
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
on public.projects for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
on public.projects for delete
using ((select auth.uid()) = user_id);

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks for select
using ((select auth.uid()) = user_id);
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks for delete
using ((select auth.uid()) = user_id);

drop policy if exists "constraints_select_own" on public.task_constraints;
create policy "constraints_select_own"
on public.task_constraints for select
using ((select auth.uid()) = user_id);
drop policy if exists "constraints_insert_own" on public.task_constraints;
create policy "constraints_insert_own"
on public.task_constraints for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "constraints_update_own" on public.task_constraints;
create policy "constraints_update_own"
on public.task_constraints for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "constraints_delete_own" on public.task_constraints;
create policy "constraints_delete_own"
on public.task_constraints for delete
using ((select auth.uid()) = user_id);

drop policy if exists "routines_select_own" on public.routines;
create policy "routines_select_own"
on public.routines for select
using ((select auth.uid()) = user_id);
drop policy if exists "routines_insert_own" on public.routines;
create policy "routines_insert_own"
on public.routines for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "routines_update_own" on public.routines;
create policy "routines_update_own"
on public.routines for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "routines_delete_own" on public.routines;
create policy "routines_delete_own"
on public.routines for delete
using ((select auth.uid()) = user_id);

drop policy if exists "calendar_events_select_own" on public.calendar_events;
create policy "calendar_events_select_own"
on public.calendar_events for select
using ((select auth.uid()) = user_id);
drop policy if exists "calendar_events_insert_own" on public.calendar_events;
create policy "calendar_events_insert_own"
on public.calendar_events for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "calendar_events_update_own" on public.calendar_events;
create policy "calendar_events_update_own"
on public.calendar_events for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "calendar_events_delete_own" on public.calendar_events;
create policy "calendar_events_delete_own"
on public.calendar_events for delete
using ((select auth.uid()) = user_id);

drop policy if exists "planned_segments_select_own" on public.planned_segments;
create policy "planned_segments_select_own"
on public.planned_segments for select
using ((select auth.uid()) = user_id);
drop policy if exists "planned_segments_insert_own" on public.planned_segments;
create policy "planned_segments_insert_own"
on public.planned_segments for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "planned_segments_update_own" on public.planned_segments;
create policy "planned_segments_update_own"
on public.planned_segments for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "planned_segments_delete_own" on public.planned_segments;
create policy "planned_segments_delete_own"
on public.planned_segments for delete
using ((select auth.uid()) = user_id);

drop policy if exists "planner_snapshots_select_own" on public.planner_snapshots;
create policy "planner_snapshots_select_own"
on public.planner_snapshots for select
using ((select auth.uid()) = user_id);
drop policy if exists "planner_snapshots_insert_own" on public.planner_snapshots;
create policy "planner_snapshots_insert_own"
on public.planner_snapshots for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "planner_snapshots_update_own" on public.planner_snapshots;
create policy "planner_snapshots_update_own"
on public.planner_snapshots for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "planner_snapshots_delete_own" on public.planner_snapshots;
create policy "planner_snapshots_delete_own"
on public.planner_snapshots for delete
using ((select auth.uid()) = user_id);

commit;
