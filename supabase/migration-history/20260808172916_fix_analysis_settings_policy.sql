begin;
drop policy if exists academy_analysis_settings_admin_write on public.academy_analysis_settings;
create policy academy_analysis_settings_admin_insert on public.academy_analysis_settings for insert to authenticated with check(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]) and updated_by=(select auth.uid()));
create policy academy_analysis_settings_admin_update on public.academy_analysis_settings for update to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[])) with check(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]) and updated_by=(select auth.uid()));
commit;
