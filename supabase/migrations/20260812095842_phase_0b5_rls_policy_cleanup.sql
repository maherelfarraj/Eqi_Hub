-- Phase 0B.5: preserve authorization behavior while removing deprecated
-- auth.role(), per-row auth.uid() initialization, and overlapping permissive
-- SELECT/UPDATE policies reported by Supabase advisors.

begin;

drop policy if exists documents_access on public.documents;
create policy documents_access on public.documents for all to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.horses h
    where h.id = documents.horse_id and h.owner_id = (select auth.uid())
  )
)
with check ((select auth.uid()) = user_id);

drop policy if exists health_records_access on public.health_records;
create policy health_records_access on public.health_records for all to authenticated
using (exists (
  select 1 from public.horses h
  where h.id = health_records.horse_id and h.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.horses h
  where h.id = health_records.horse_id and h.owner_id = (select auth.uid())
));

drop policy if exists invoice_lines_select_own on public.invoice_lines;
create policy invoice_lines_select_own on public.invoice_lines for select to authenticated
using (exists (
  select 1 from public.invoices i
  where i.id = invoice_lines.invoice_id and i.user_id = (select auth.uid())
));

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists lessons_select on public.lessons;
drop policy if exists lessons_insert_rider on public.lessons;
drop policy if exists lessons_update_rider on public.lessons;
drop policy if exists lessons_update_trainer on public.lessons;
drop policy if exists lessons_delete_rider on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
using ((select auth.uid()) = rider_id or (select auth.uid()) = trainer_id);
create policy lessons_insert_rider on public.lessons for insert to authenticated
with check ((select auth.uid()) = rider_id);
create policy lessons_update_participant on public.lessons for update to authenticated
using ((select auth.uid()) = rider_id or (select auth.uid()) = trainer_id)
with check ((select auth.uid()) = rider_id or (select auth.uid()) = trainer_id);
create policy lessons_delete_rider on public.lessons for delete to authenticated
using ((select auth.uid()) = rider_id);

drop policy if exists plans_select on public.membership_plans;
create policy plans_select on public.membership_plans for select to authenticated
using (active = true);

drop policy if exists prefs_all_own on public.notification_prefs;
create policy prefs_all_own on public.notification_prefs for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_trainers on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_authorized on public.profiles for select to authenticated
using ((select auth.uid()) = id or role = 'trainer');
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists training_log_access on public.training_log;
create policy training_log_access on public.training_log for all to authenticated
using (exists (
  select 1 from public.horses h
  where h.id = training_log.horse_id
    and (
      h.owner_id = (select auth.uid())
      or exists (
        select 1 from public.horse_riders hr
        where hr.horse_id = h.id and hr.rider_id = (select auth.uid())
      )
    )
))
with check (author_id = (select auth.uid()));

drop policy if exists horses_modify_owner on public.horses;
drop policy if exists horses_select on public.horses;
create policy horses_select on public.horses for select to authenticated
using (owner_id = (select auth.uid()) or (select private.is_horse_rider(id)));
create policy horses_insert_owner on public.horses for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy horses_update_owner on public.horses for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy horses_delete_owner on public.horses for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists analyses_all_own on public.video_analyses;
drop policy if exists analyses_select_trainer on public.video_analyses;
create policy analyses_select_participant on public.video_analyses for select to authenticated
using (
  rider_id = (select auth.uid())
  or exists (
    select 1 from public.lessons lesson
    where lesson.analysis_id = video_analyses.id
      and lesson.trainer_id = (select auth.uid())
  )
);
create policy analyses_insert_rider on public.video_analyses for insert to authenticated
with check (rider_id = (select auth.uid()));
create policy analyses_update_rider on public.video_analyses for update to authenticated
using (rider_id = (select auth.uid()))
with check (rider_id = (select auth.uid()));
create policy analyses_delete_rider on public.video_analyses for delete to authenticated
using (rider_id = (select auth.uid()));

commit;
