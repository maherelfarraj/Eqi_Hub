-- Roll back the Batch 3 composite guardian relationship indexes.
begin;

drop index if exists public.guardian_access_events_relationship_idx;
drop index if exists public.guardian_approval_requests_relationship_idx;

commit;
