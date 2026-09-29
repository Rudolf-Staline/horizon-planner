alter table public.tasks add column series_id uuid;
create index tasks_user_series_idx on public.tasks (user_id, series_id) where series_id is not null;
