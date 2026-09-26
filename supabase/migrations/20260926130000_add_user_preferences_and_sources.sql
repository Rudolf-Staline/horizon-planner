begin;

alter table public.profiles
  add column if not exists workday_start_min smallint not null default 420
    check (workday_start_min between 0 and 1380),
  add column if not exists workday_end_min smallint not null default 1320
    check (workday_end_min between 15 and 1440),
  add column if not exists active_days smallint[] not null default '{0,1,2,3,4}'::smallint[]
    check (active_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  add column if not exists default_duration_min smallint not null default 60
    check (default_duration_min between 15 and 1440),
  add column if not exists focus_block_min smallint not null default 50
    check (focus_block_min between 15 and 240),
  add column if not exists buffer_min smallint not null default 10
    check (buffer_min between 0 and 120),
  add column if not exists energy_preference text not null default 'balanced'
    check (energy_preference in ('low','balanced','high')),
  add column if not exists planning_step_min smallint not null default 15
    check (planning_step_min in (5,10,15,30,60)),
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists reminder_lead_min smallint not null default 10
    check (reminder_lead_min between 0 and 120);

alter table public.profiles
  add constraint profiles_workday_range_check
  check (workday_end_min > workday_start_min);

create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('ics','google','outlook')),
  name text not null check (char_length(name) between 1 and 160),
  feed_url text not null check (char_length(feed_url) between 8 and 2000),
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_sources_user_idx
  on public.calendar_sources(user_id, enabled);

drop trigger if exists calendar_sources_set_updated_at
  on public.calendar_sources;
create trigger calendar_sources_set_updated_at
before update on public.calendar_sources
for each row execute function public.set_updated_at();

alter table public.calendar_sources enable row level security;

create policy "calendar_sources_select_own"
on public.calendar_sources for select
using ((select auth.uid()) = user_id);
create policy "calendar_sources_insert_own"
on public.calendar_sources for insert
with check ((select auth.uid()) = user_id);
create policy "calendar_sources_update_own"
on public.calendar_sources for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "calendar_sources_delete_own"
on public.calendar_sources for delete
using ((select auth.uid()) = user_id);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log(target_user_id, created_at desc);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log(actor_user_id, created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_admin_select"
on public.admin_audit_log for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

commit;
