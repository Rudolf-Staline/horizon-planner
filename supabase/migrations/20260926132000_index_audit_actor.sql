begin;
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log(actor_user_id, created_at desc);
commit;
