-- Reject writes from browser sessions that predate the most recent data reset.
create schema if not exists private;

create or replace function private.guard_planner_reset_epoch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reset_at timestamptz;
  request_epoch text;
begin
  -- Maintenance SQL and service-role integrations do not carry an end-user JWT.
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select p.data_reset_at into reset_at
  from public.profiles p where p.id = auth.uid();

  if reset_at is not null then
    request_epoch := nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb
      ->> 'x-horizon-reset-epoch';
    if request_epoch is distinct from
      (pg_catalog.floor(extract(epoch from reset_at) * 1000)::bigint)::text then
      raise exception 'Planner data was reset; reload the application to continue'
        using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_planner_reset_epoch() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects', 'tasks', 'task_constraints', 'routines',
    'routine_exceptions', 'calendar_events', 'calendar_sources',
    'planned_segments', 'planner_snapshots'
  ] loop
    execute format('create trigger guard_reset_epoch before insert or update or delete on public.%I for each row execute function private.guard_planner_reset_epoch()', table_name);
  end loop;
end;
$$;

-- An authenticated client must not erase or forge its own reset marker.
create or replace function private.guard_profile_reset_epoch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null and
     new.data_reset_at is distinct from old.data_reset_at then
    raise exception 'Planner reset marker cannot be changed by a client'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_profile_reset_epoch() from public, anon, authenticated;
create trigger guard_profile_reset_epoch before update on public.profiles
  for each row execute function private.guard_profile_reset_epoch();
