-- Synchronize the production advisor remediation applied on 2026-08-15.
-- No data changes: optimize legacy RLS evaluation and add covering FK indexes.

alter policy "Users can view own profile"
on legacy.profiles
using ((select auth.uid()) = id);

alter policy "Users can update own profile"
on legacy.profiles
using ((select auth.uid()) = id);

alter policy "Admins can view all profiles"
on legacy.profiles
using (
  exists (
    select 1
    from legacy.profiles p
    where p.id = (select auth.uid())
      and p.role = any (array['super_admin'::text, 'admin'::text])
  )
);

alter policy "Super admins can update all profiles"
on legacy.profiles
using (
  exists (
    select 1
    from legacy.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'::text
  )
);

create index if not exists coaches_profile_id_idx
  on legacy.coaches (profile_id);
create index if not exists lessons_coach_id_idx
  on legacy.lessons (coach_id);
create index if not exists lessons_horse_id_idx
  on legacy.lessons (horse_id);
create index if not exists lessons_package_id_idx
  on legacy.lessons (package_id);
create index if not exists lessons_rider_id_idx
  on legacy.lessons (rider_id);
create index if not exists parents_profile_id_idx
  on legacy.parents (profile_id);
create index if not exists rider_packages_rider_id_idx
  on legacy.rider_packages (rider_id);
create index if not exists rider_parent_links_parent_id_idx
  on legacy.rider_parent_links (parent_id);
create index if not exists rider_parent_links_rider_id_idx
  on legacy.rider_parent_links (rider_id);
create index if not exists riders_profile_id_idx
  on legacy.riders (profile_id);
