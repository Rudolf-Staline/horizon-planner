-- A reset watermark prevents old per-account browser caches from restoring
-- deleted planner rows when an account next signs in.
alter table public.profiles
  add column if not exists data_reset_at timestamptz;
