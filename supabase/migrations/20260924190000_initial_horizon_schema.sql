begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  notes text,
  category text not null default 'neutral'
    check (category in ('course','project','personal','focus','routine','admin','flexible','neutral')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high')),
  kind text not null default 'flexible'
    check (kind in ('fixed','flexible')),
  duration_min integer not null check (duration_min between 15 and 1440),
  locked boolean not null default false,
  status text not null default 'open'
    check (status in ('open','planned','in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_constraints (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  earliest_date date,
  deadline_date date,
  window_start time,
  window_end time,
  energy text check (energy in ('low','medium','high')),
  splittable boolean not null default false,
  min_chunk_min integer check (min_chunk_min is null or min_chunk_min between 15 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    deadline_date is null
    or earliest_date is null
    or deadline_date >= earliest_date
  ),
  check (
    window_start is null
    or window_end is null
    or window_end > window_start
  )
);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  category text not null default 'routine'
    check (category in ('course','project','personal','focus','routine','admin','flexible','neutral')),
  duration_min integer not null check (duration_min between 15 and 1440),
  days smallint[] not null default '{}',
  preferred_start time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not exists (
      select 1 from unnest(days) d where d < 0 or d > 6
    )
  )
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  category text not null default 'neutral'
    check (category in ('course','project','personal','focus','routine','admin','flexible','neutral')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  locked boolean not null default true,
  source text not null default 'manual'
    check (source in ('manual','google','outlook','ics')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.planned_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  segment_index integer not null default 0 check (segment_index >= 0),
  status text not null default 'planned'
    check (status in ('planned','in_progress','completed','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((task_id is not null) <> (routine_id is not null))
);

-- Transitional local-first bridge. The normalized tables above remain
-- the long-term source model; this row lets the current prototype sync
-- its PlannerEvent[] atomically while the normalized CRUD UI is built.
create table if not exists public.planner_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'array')
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_project_id_idx on public.tasks(project_id);
create index if not exists tasks_status_idx on public.tasks(user_id, status);
create index if not exists constraints_user_id_idx on public.task_constraints(user_id);
create index if not exists routines_user_id_idx on public.routines(user_id);
create index if not exists calendar_events_user_time_idx
  on public.calendar_events(user_id, starts_at, ends_at);
create unique index if not exists calendar_events_external_unique
  on public.calendar_events(user_id, source, external_id)
  where external_id is not null;
create index if not exists planned_segments_user_time_idx
  on public.planned_segments(user_id, starts_at, ends_at);
create index if not exists planned_segments_task_idx
  on public.planned_segments(task_id, segment_index);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger task_constraints_set_updated_at
before update on public.task_constraints
for each row execute function public.set_updated_at();

create trigger routines_set_updated_at
before update on public.routines
for each row execute function public.set_updated_at();

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

create trigger planned_segments_set_updated_at
before update on public.planned_segments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_constraints enable row level security;
alter table public.routines enable row level security;
alter table public.calendar_events enable row level security;
alter table public.planned_segments enable row level security;
alter table public.planner_snapshots enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "projects_select_own"
on public.projects for select
using (auth.uid() = user_id);
create policy "projects_insert_own"
on public.projects for insert
with check (auth.uid() = user_id);
create policy "projects_update_own"
on public.projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "projects_delete_own"
on public.projects for delete
using (auth.uid() = user_id);

create policy "tasks_select_own"
on public.tasks for select
using (auth.uid() = user_id);
create policy "tasks_insert_own"
on public.tasks for insert
with check (auth.uid() = user_id);
create policy "tasks_update_own"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "tasks_delete_own"
on public.tasks for delete
using (auth.uid() = user_id);

create policy "constraints_select_own"
on public.task_constraints for select
using (auth.uid() = user_id);
create policy "constraints_insert_own"
on public.task_constraints for insert
with check (auth.uid() = user_id);
create policy "constraints_update_own"
on public.task_constraints for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "constraints_delete_own"
on public.task_constraints for delete
using (auth.uid() = user_id);

create policy "routines_select_own"
on public.routines for select
using (auth.uid() = user_id);
create policy "routines_insert_own"
on public.routines for insert
with check (auth.uid() = user_id);
create policy "routines_update_own"
on public.routines for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "routines_delete_own"
on public.routines for delete
using (auth.uid() = user_id);

create policy "calendar_events_select_own"
on public.calendar_events for select
using (auth.uid() = user_id);
create policy "calendar_events_insert_own"
on public.calendar_events for insert
with check (auth.uid() = user_id);
create policy "calendar_events_update_own"
on public.calendar_events for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "calendar_events_delete_own"
on public.calendar_events for delete
using (auth.uid() = user_id);

create policy "planned_segments_select_own"
on public.planned_segments for select
using (auth.uid() = user_id);
create policy "planned_segments_insert_own"
on public.planned_segments for insert
with check (auth.uid() = user_id);
create policy "planned_segments_update_own"
on public.planned_segments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "planned_segments_delete_own"
on public.planned_segments for delete
using (auth.uid() = user_id);

create policy "planner_snapshots_select_own"
on public.planner_snapshots for select
using (auth.uid() = user_id);
create policy "planner_snapshots_insert_own"
on public.planner_snapshots for insert
with check (auth.uid() = user_id);
create policy "planner_snapshots_update_own"
on public.planner_snapshots for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "planner_snapshots_delete_own"
on public.planner_snapshots for delete
using (auth.uid() = user_id);

commit;
