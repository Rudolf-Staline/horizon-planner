-- One-time reset of the Horizon application data in the existing project.
-- Run after deploying the client that respects profiles.data_reset_at.
-- The only retained account is the current administrator and its profile.
begin;

do $$
begin
  if (select count(*) from auth.users) <> 1
     or (select count(*) from public.profiles where role = 'admin') <> 1 then
    raise exception 'Horizon reset stopped: expected exactly one auth user and one admin';
  end if;
end $$;

delete from public.planned_segments;
delete from public.task_constraints;
delete from public.routine_exceptions;
delete from public.calendar_events;
delete from public.calendar_sources;
delete from public.planner_snapshots;
delete from public.tasks;
delete from public.routines;
delete from public.projects;
delete from public.admin_audit_log;

update public.profiles
set data_reset_at = clock_timestamp()
where role = 'admin';

do $$
begin
  if (select count(*) from public.tasks) <> 0
     or (select count(*) from public.planned_segments) <> 0
     or (select count(*) from public.planner_snapshots) <> 0
     or (select count(*) from public.projects) <> 0
     or (select count(*) from public.routines) <> 0
     or (select count(*) from public.calendar_events) <> 0
     or (select count(*) from public.calendar_sources) <> 0
     or (select count(*) from public.admin_audit_log) <> 0
     or (select count(*) from public.profiles where data_reset_at is not null) <> 1 then
    raise exception 'Horizon reset stopped: post-reset verification failed';
  end if;
end $$;

commit;
