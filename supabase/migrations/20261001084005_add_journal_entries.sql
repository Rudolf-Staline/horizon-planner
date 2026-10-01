create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  title text not null default '' check (char_length(title) <= 160),
  content text not null check (char_length(content) <= 100000 and length(btrim(content)) > 0),
  mood smallint check (mood between 1 and 5),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_owner_date_idx on public.journal_entries(user_id, archived, entry_date desc, created_at desc, id);
alter table public.journal_entries enable row level security;
revoke all on public.journal_entries from public, anon, authenticated;
grant select, insert, update on public.journal_entries to authenticated;
grant all on public.journal_entries to service_role;
create policy journal_owner_read on public.journal_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy journal_owner_insert on public.journal_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy journal_owner_update on public.journal_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger journal_entries_set_updated_at before update on public.journal_entries for each row execute function public.set_updated_at();
