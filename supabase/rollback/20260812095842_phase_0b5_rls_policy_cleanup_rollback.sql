-- Restore the pre-Phase 0B.5 policy topology and expressions.
begin;

drop policy if exists documents_access on public.documents;
create policy documents_access on public.documents for all
using (auth.uid() = user_id or exists (
  select 1 from public.horses h
  where h.id = documents.horse_id and h.owner_id = auth.uid()
)) with check (auth.uid() = user_id);

drop policy if exists health_records_access on public.health_records;
create policy health_records_access on public.health_records for all
using (exists (select 1 from public.horses h where h.id = health_records.horse_id and h.owner_id = auth.uid()))
with check (exists (select 1 from public.horses h where h.id = health_records.horse_id and h.owner_id = auth.uid()));

drop policy if exists invoice_lines_select_own on public.invoice_lines;
create policy invoice_lines_select_own on public.invoice_lines for select
using (exists (select 1 from public.invoices i where i.id = invoice_lines.invoice_id and i.user_id = auth.uid()));

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices for select using (auth.uid() = user_id);

drop policy if exists lessons_select on public.lessons;
drop policy if exists lessons_insert_rider on public.lessons;
drop policy if exists lessons_update_participant on public.lessons;
drop policy if exists lessons_delete_rider on public.lessons;
create policy lessons_select on public.lessons for select using (auth.uid() = rider_id or auth.uid() = trainer_id);
create policy lessons_insert_rider on public.lessons for insert with check (auth.uid() = rider_id);
create policy lessons_update_rider on public.lessons for update using (auth.uid() = rider_id) with check (auth.uid() = rider_id);
create policy lessons_update_trainer on public.lessons for update using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);
create policy lessons_delete_rider on public.lessons for delete using (auth.uid() = rider_id);

drop policy if exists plans_select on public.membership_plans;
create policy plans_select on public.membership_plans for select using (auth.role() = 'authenticated' and active = true);

drop policy if exists prefs_all_own on public.notification_prefs;
create policy prefs_all_own on public.notification_prefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists profiles_select_authorized on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_select_trainers on public.profiles for select using (role = 'trainer' and auth.role() = 'authenticated');
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists training_log_access on public.training_log;
create policy training_log_access on public.training_log for all
using (exists (
  select 1 from public.horses h where h.id = training_log.horse_id
  and (h.owner_id = auth.uid() or exists (
    select 1 from public.horse_riders hr where hr.horse_id = h.id and hr.rider_id = auth.uid()
  ))
)) with check (author_id = auth.uid());

drop policy if exists horses_select on public.horses;
drop policy if exists horses_insert_owner on public.horses;
drop policy if exists horses_update_owner on public.horses;
drop policy if exists horses_delete_owner on public.horses;
create policy horses_modify_owner on public.horses for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy horses_select on public.horses for select to authenticated
using (owner_id = (select auth.uid()) or private.is_horse_rider(id));

drop policy if exists analyses_select_participant on public.video_analyses;
drop policy if exists analyses_insert_rider on public.video_analyses;
drop policy if exists analyses_update_rider on public.video_analyses;
drop policy if exists analyses_delete_rider on public.video_analyses;
create policy analyses_all_own on public.video_analyses for all using (auth.uid() = rider_id) with check (auth.uid() = rider_id);
create policy analyses_select_trainer on public.video_analyses for select to authenticated
using (exists (select 1 from public.lessons lesson where lesson.analysis_id = video_analyses.id and lesson.trainer_id = (select auth.uid())));

commit;
