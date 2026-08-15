-- Synchronize the production advisor remediation applied on 2026-08-15.
-- The legacy schema exists only in restored production databases. Fresh preview
-- databases safely record this migration as a no-op.

do $migration$
begin
  if to_regclass('legacy.profiles') is null then
    raise notice 'Skipping production-only legacy optimization: legacy.profiles is absent';
    return;
  end if;

  execute $sql$
    alter policy "Users can view own profile"
    on legacy.profiles
    using ((select auth.uid()) = id)
  $sql$;

  execute $sql$
    alter policy "Users can update own profile"
    on legacy.profiles
    using ((select auth.uid()) = id)
  $sql$;

  execute $sql$
    alter policy "Admins can view all profiles"
    on legacy.profiles
    using (
      exists (
        select 1
        from legacy.profiles p
        where p.id = (select auth.uid())
          and p.role = any (array['super_admin'::text, 'admin'::text])
      )
    )
  $sql$;

  execute $sql$
    alter policy "Super admins can update all profiles"
    on legacy.profiles
    using (
      exists (
        select 1
        from legacy.profiles p
        where p.id = (select auth.uid())
          and p.role = 'super_admin'::text
      )
    )
  $sql$;

  if to_regclass('legacy.coaches') is not null then
    execute 'create index if not exists coaches_profile_id_idx on legacy.coaches (profile_id)';
  end if;
  if to_regclass('legacy.lessons') is not null then
    execute 'create index if not exists lessons_coach_id_idx on legacy.lessons (coach_id)';
    execute 'create index if not exists lessons_horse_id_idx on legacy.lessons (horse_id)';
    execute 'create index if not exists lessons_package_id_idx on legacy.lessons (package_id)';
    execute 'create index if not exists lessons_rider_id_idx on legacy.lessons (rider_id)';
  end if;
  if to_regclass('legacy.parents') is not null then
    execute 'create index if not exists parents_profile_id_idx on legacy.parents (profile_id)';
  end if;
  if to_regclass('legacy.rider_packages') is not null then
    execute 'create index if not exists rider_packages_rider_id_idx on legacy.rider_packages (rider_id)';
  end if;
  if to_regclass('legacy.rider_parent_links') is not null then
    execute 'create index if not exists rider_parent_links_parent_id_idx on legacy.rider_parent_links (parent_id)';
    execute 'create index if not exists rider_parent_links_rider_id_idx on legacy.rider_parent_links (rider_id)';
  end if;
  if to_regclass('legacy.riders') is not null then
    execute 'create index if not exists riders_profile_id_idx on legacy.riders (profile_id)';
  end if;
end
$migration$;
