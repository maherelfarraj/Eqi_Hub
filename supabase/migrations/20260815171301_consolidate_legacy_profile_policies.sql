-- Consolidate overlapping legacy profile policies while preserving access semantics.
-- Restrict evaluation to authenticated callers and evaluate auth.uid() once per statement.

drop policy if exists "Users can view own profile" on legacy.profiles;
drop policy if exists "Admins can view all profiles" on legacy.profiles;
drop policy if exists "Users can update own profile" on legacy.profiles;
drop policy if exists "Super admins can update all profiles" on legacy.profiles;

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
);

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
);
