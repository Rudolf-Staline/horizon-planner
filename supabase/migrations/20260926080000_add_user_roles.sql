begin;

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

create index if not exists profiles_role_idx
  on public.profiles(role);

update public.profiles
set role = 'admin'
where id = (
  select id
  from public.profiles
  order by created_at asc
  limit 1
)
and not exists (
  select 1
  from public.profiles
  where role = 'admin'
);

commit;
