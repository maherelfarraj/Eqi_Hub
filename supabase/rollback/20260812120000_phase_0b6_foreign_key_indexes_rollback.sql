-- Roll back Phase 0B.6 foreign-key indexes.

begin;

drop index if exists public.training_log_horse_id_idx;
drop index if exists public.training_log_author_id_idx;
drop index if exists public.memberships_plan_id_idx;
drop index if exists public.invoices_payment_method_id_idx;
drop index if exists public.health_records_horse_id_idx;
drop index if exists public.documents_user_id_idx;
drop index if exists public.documents_horse_id_idx;

commit;
