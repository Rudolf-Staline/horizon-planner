begin;

create table if not exists public.routine_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null,
  occurs_on date not null,
  action text not null check (action in ('skip','override')),
  override_start time,
  override_duration_min integer
    check (
      override_duration_min is null
      or override_duration_min between 15 and 1440
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, occurs_on),
  foreign key (routine_id, user_id)
    references public.routines(id, user_id)
    on delete cascade
);

create index if not exists routine_exceptions_user_date_idx
  on public.routine_exceptions(user_id, occurs_on);

drop trigger if exists routine_exceptions_set_updated_at
  on public.routine_exceptions;
create trigger routine_exceptions_set_updated_at
before update on public.routine_exceptions
for each row execute function public.set_updated_at();

alter table public.routine_exceptions enable row level security;

drop policy if exists "routine_exceptions_select_own"
  on public.routine_exceptions;
create policy "routine_exceptions_select_own"
on public.routine_exceptions for select
using ((select auth.uid()) = user_id);

drop policy if exists "routine_exceptions_insert_own"
  on public.routine_exceptions;
create policy "routine_exceptions_insert_own"
on public.routine_exceptions for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "routine_exceptions_update_own"
  on public.routine_exceptions;
create policy "routine_exceptions_update_own"
on public.routine_exceptions for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "routine_exceptions_delete_own"
  on public.routine_exceptions;
create policy "routine_exceptions_delete_own"
on public.routine_exceptions for delete
using ((select auth.uid()) = user_id);

commit;