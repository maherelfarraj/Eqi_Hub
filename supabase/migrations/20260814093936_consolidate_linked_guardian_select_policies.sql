-- Consolidate linked-guardian read access without widening write access.
begin;

drop policy if exists documents_linked_guardian_select on public.documents;
drop policy if exists documents_access on public.documents;
drop policy if exists documents_insert_access on public.documents;
drop policy if exists documents_update_access on public.documents;
drop policy if exists documents_delete_access on public.documents;

create policy documents_access
on public.documents for select to authenticated
using (
  (select auth.uid()) = user_id
  or (
    horse_id is not null
    and (select private.can_access_horse(documents.horse_id))
  )
);

create policy documents_insert_access
on public.documents for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy documents_update_access
on public.documents for update to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.horses as horse
    where horse.id = documents.horse_id
      and horse.owner_id = (select auth.uid())
  )
)
with check ((select auth.uid()) = user_id);

create policy documents_delete_access
on public.documents for delete to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.horses as horse
    where horse.id = documents.horse_id
      and horse.owner_id = (select auth.uid())
  )
);

drop policy if exists health_records_linked_guardian_select
on public.health_records;
drop policy if exists health_records_access on public.health_records;
drop policy if exists health_records_insert_access on public.health_records;
drop policy if exists health_records_update_access on public.health_records;
drop policy if exists health_records_delete_access on public.health_records;

create policy health_records_access
on public.health_records for select to authenticated
using ((select private.can_access_horse(health_records.horse_id)));

create policy health_records_insert_access
on public.health_records for insert to authenticated
with check (
  exists (
    select 1
    from public.horses as horse
    where horse.id = health_records.horse_id
      and horse.owner_id = (select auth.uid())
  )
);

create policy health_records_update_access
on public.health_records for update to authenticated
using (
  exists (
    select 1
    from public.horses as horse
    where horse.id = health_records.horse_id
      and horse.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.horses as horse
    where horse.id = health_records.horse_id
      and horse.owner_id = (select auth.uid())
  )
);

create policy health_records_delete_access
on public.health_records for delete to authenticated
using (
  exists (
    select 1
    from public.horses as horse
    where horse.id = health_records.horse_id
      and horse.owner_id = (select auth.uid())
  )
);

drop policy if exists training_log_linked_guardian_select
on public.training_log;
drop policy if exists training_log_access on public.training_log;
drop policy if exists training_log_insert_access on public.training_log;
drop policy if exists training_log_update_access on public.training_log;
drop policy if exists training_log_delete_access on public.training_log;

create policy training_log_access
on public.training_log for select to authenticated
using ((select private.can_access_horse(training_log.horse_id)));

create policy training_log_insert_access
on public.training_log for insert to authenticated
with check (author_id = (select auth.uid()));

create policy training_log_update_access
on public.training_log for update to authenticated
using (
  exists (
    select 1
    from public.horses as horse
    where horse.id = training_log.horse_id
      and (
        horse.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.horse_riders as horse_rider
          where horse_rider.horse_id = horse.id
            and horse_rider.rider_id = (select auth.uid())
        )
      )
  )
)
with check (author_id = (select auth.uid()));

create policy training_log_delete_access
on public.training_log for delete to authenticated
using (
  exists (
    select 1
    from public.horses as horse
    where horse.id = training_log.horse_id
      and (
        horse.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.horse_riders as horse_rider
          where horse_rider.horse_id = horse.id
            and horse_rider.rider_id = (select auth.uid())
        )
      )
  )
);

commit;
