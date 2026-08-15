-- Cover the composite guardian relationship foreign keys identified by the
-- Supabase database advisor after Batch 3 preview acceptance.
begin;

create index guardian_approval_requests_relationship_idx
  on public.guardian_approval_requests (organization_id, guardian_id, rider_id);

create index guardian_access_events_relationship_idx
  on public.guardian_access_events (organization_id, guardian_id, rider_id);

commit;
