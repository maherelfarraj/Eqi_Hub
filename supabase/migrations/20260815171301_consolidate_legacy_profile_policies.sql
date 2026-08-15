-- Consolidate overlapping legacy profile policies while preserving access semantics.
-- The legacy schema exists only in restored production databases. Fresh preview
-- databases safely record this migration as a no-op.

do $migration$
begin
  if to_regclass('legacy.profiles') is null then
    raise notice 'Skipping production-only legacy policy consolidation: legacy.profiles is absent';
    return;
  end if;

  execute 'drop policy if exists "Users can view own profile" on legacy.profiles';
  execute 'drop policy if exists "Admins can view all profiles" on legacy.profiles';
  execute 'drop policy if exists "Users can update own profile" on legacy.profiles';
  execute 'drop policy if exists "Super admins can update all profiles" on legacy.profiles';

  execute $sql$
    create policy "Authenticated profile visibility"
    on legacy.profiles
    for select
    to authenticated
    using (
      id = (select auth.uid())
      or exists (
        select 1
        from legacy.profiles p
        where p.id = (select auth.uid())
          and p.role = any (array['super_admin'::text, 'admin'::text])
      )
    )
  $sql$;

  execute $sql$
    create policy "Authenticated profile updates"
    on legacy.profiles
    for update
    to authenticated
    using (
      id = (select auth.uid())
      or exists (
        select 1
        from legacy.profiles p
        where p.id = (select auth.uid())
          and p.role = 'super_admin'::text
      )
    )
    with check (
      id = (select auth.uid())
      or exists (
        select 1
        from legacy.profiles p
        where p.id = (select auth.uid())
          and p.role = 'super_admin'::text
      )
    )
  $sql$;
end
$migration$;
