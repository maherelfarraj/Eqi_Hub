-- Phase 0B.6: add covering indexes for foreign keys reported by the
-- Supabase Performance Advisor. These indexes preserve data and behavior.

begin;

create index documents_horse_id_idx
  on public.documents (horse_id);

create index documents_user_id_idx
  on public.documents (user_id);

create index health_records_horse_id_idx
  on public.health_records (horse_id);

create index invoices_payment_method_id_idx
  on public.invoices (payment_method_id);

create index memberships_plan_id_idx
  on public.memberships (plan_id);

create index training_log_author_id_idx
  on public.training_log (author_id);

create index training_log_horse_id_idx
  on public.training_log (horse_id);

commit;
