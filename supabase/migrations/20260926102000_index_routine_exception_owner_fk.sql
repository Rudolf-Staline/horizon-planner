begin;

create index if not exists routine_exceptions_routine_owner_idx
  on public.routine_exceptions(routine_id, user_id);

commit;
