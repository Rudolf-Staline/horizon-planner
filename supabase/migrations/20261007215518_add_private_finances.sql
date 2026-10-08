begin;
create table public.finance_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  check ((jsonb_typeof(payload) = 'object' and payload->>'version' = '1'
    and jsonb_typeof(payload->'accounts') = 'array'
    and jsonb_typeof(payload->'entries') = 'array'
    and jsonb_typeof(payload->'budgets') = 'array'
    and jsonb_typeof(payload->'goals') = 'array'
    and jsonb_typeof(payload->'recurrences') = 'array'
    and octet_length(payload::text) <= 2000000) is true)
);
alter table public.finance_state enable row level security;
revoke all on public.finance_state from anon, authenticated;
grant select, insert, update on public.finance_state to authenticated;
create policy finance_select_own on public.finance_state for select to authenticated using ((select auth.uid()) = user_id);
create policy finance_insert_own on public.finance_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy finance_update_own on public.finance_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- One compare-and-swap commits both sides of a transfer and refuses to
-- replace a newer version from another browser session. No privileged key.
create function public.save_finances(expected_revision bigint, next_payload jsonb)
returns bigint language plpgsql security invoker set search_path = public, pg_temp as $$
declare next_revision bigint; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if expected_revision = 0 then
    insert into public.finance_state(user_id, payload, revision)
    values(owner_id, next_payload, 1)
    on conflict(user_id) do nothing returning revision into next_revision;
  else
    update public.finance_state set payload = next_payload, revision = revision + 1, updated_at = now()
    where user_id = owner_id and revision = expected_revision
    returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'finance_conflict' using errcode = '40001'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_finances(bigint, jsonb) from public, anon;
grant execute on function public.save_finances(bigint, jsonb) to authenticated;
commit;
