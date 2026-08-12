
create type public.rider_pathway_outcome as enum (
  'developing',
  'ready',
  'achieved'
);

create table public.rider_pathway_assessments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null
    references public.academies(id) on delete cascade,
  rider_user_id uuid not null
    references auth.users(id) on delete restrict,
  grade smallint not null,
  outcome public.rider_pathway_outcome not null,
  safety_score smallint not null,
  balance_score smallint not null,
  control_score smallint not null,
  confidence_score smallint not null,
  summary text not null,
  next_focus text not null,
  assessed_at timestamptz not null,
  assessed_by uuid not null
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_pathway_grade_range check (grade between 1 and 10),
  constraint rider_pathway_safety_score_range check (safety_score between 1 and 5),
  constraint rider_pathway_balance_score_range check (balance_score between 1 and 5),
  constraint rider_pathway_control_score_range check (control_score between 1 and 5),
  constraint rider_pathway_confidence_score_range check (confidence_score between 1 and 5),
  constraint rider_pathway_summary_length
    check (char_length(btrim(summary)) between 10 and 2000),
  constraint rider_pathway_next_focus_length
    check (char_length(btrim(next_focus)) between 3 and 1500)
);

create index rider_pathway_academy_rider_assessed_idx
  on public.rider_pathway_assessments (
    academy_id,
    rider_user_id,
    assessed_at desc
  );
create index rider_pathway_rider_idx
  on public.rider_pathway_assessments (rider_user_id);
create index rider_pathway_assessed_by_idx
  on public.rider_pathway_assessments (assessed_by);
create index rider_pathway_achieved_idx
  on public.rider_pathway_assessments (
    academy_id,
    rider_user_id,
    grade desc,
    assessed_at desc
  )
  where outcome = 'achieved'::public.rider_pathway_outcome;

comment on table public.rider_pathway_assessments is
  'Role-scoped foundation grade assessments for academy riders.';

create function private.can_access_rider_pathway(
  target_academy_id uuid,
  target_rider_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_memberships rider
    where rider.academy_id = target_academy_id
      and rider.user_id = target_rider_user_id
      and rider.role = 'rider'::public.app_role
      and rider.status = 'active'::public.membership_status
      and (
        target_rider_user_id = (select auth.uid())
        or private.has_academy_role(
          target_academy_id,
          array['academy_admin']::public.app_role[]
        )
        or (
          private.has_academy_role(
            target_academy_id,
            array['coach']::public.app_role[]
          )
          and exists (
            select 1
            from public.coach_rider_assignments assignment
            where assignment.academy_id = target_academy_id
              and assignment.coach_user_id = (select auth.uid())
              and assignment.rider_user_id = target_rider_user_id
          )
        )
        or (
          private.has_academy_role(
            target_academy_id,
            array['parent']::public.app_role[]
          )
          and exists (
            select 1
            from public.parent_rider_links link
            where link.academy_id = target_academy_id
              and link.parent_user_id = (select auth.uid())
              and link.rider_user_id = target_rider_user_id
          )
        )
      )
  );
$$;

create function private.can_write_rider_pathway(
  target_academy_id uuid,
  target_rider_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_memberships rider
    where rider.academy_id = target_academy_id
      and rider.user_id = target_rider_user_id
      and rider.role = 'rider'::public.app_role
      and rider.status = 'active'::public.membership_status
      and (
        private.has_academy_role(
          target_academy_id,
          array['academy_admin']::public.app_role[]
        )
        or (
          private.has_academy_role(
            target_academy_id,
            array['coach']::public.app_role[]
          )
          and exists (
            select 1
            from public.coach_rider_assignments assignment
            where assignment.academy_id = target_academy_id
              and assignment.coach_user_id = (select auth.uid())
              and assignment.rider_user_id = target_rider_user_id
          )
        )
      )
  );
$$;

create function private.validate_rider_pathway_assessment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.academy_memberships rider
    where rider.academy_id = new.academy_id
      and rider.user_id = new.rider_user_id
      and rider.role = 'rider'::public.app_role
      and rider.status = 'active'::public.membership_status
  ) then
    raise exception 'Assessment requires an active academy rider'
      using errcode = '23514';
  end if;

  if new.assessed_at > now() + interval '5 minutes' then
    raise exception 'Assessment time cannot be in the future'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.assessed_by <> (select auth.uid())
      or not private.can_write_rider_pathway(
        new.academy_id,
        new.rider_user_id
      )
    then
      raise exception 'Only an Academy Admin or assigned coach may assess this rider'
        using errcode = '42501';
    end if;
  else
    if new.academy_id <> old.academy_id
      or new.rider_user_id <> old.rider_user_id
      or new.assessed_by <> old.assessed_by
    then
      raise exception 'Assessment ownership and scope cannot be changed'
        using errcode = '23514';
    end if;

    if not (
      private.has_academy_role(
        new.academy_id,
        array['academy_admin']::public.app_role[]
      )
      or (
        new.assessed_by = (select auth.uid())
        and private.can_write_rider_pathway(
          new.academy_id,
          new.rider_user_id
        )
      )
    ) then
      raise exception 'Only an Academy Admin or the assessing coach may update this assessment'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create function private.touch_rider_pathway_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rider_pathway_assessments_validate_scope
before insert or update on public.rider_pathway_assessments
for each row execute function private.validate_rider_pathway_assessment();

create trigger rider_pathway_assessments_touch_updated_at
before update on public.rider_pathway_assessments
for each row execute function private.touch_rider_pathway_updated_at();

alter table public.rider_pathway_assessments enable row level security;

create policy rider_pathway_assessments_select_scoped
on public.rider_pathway_assessments
for select
to authenticated
using (
  private.can_access_rider_pathway(academy_id, rider_user_id)
);

create policy rider_pathway_assessments_insert_staff
on public.rider_pathway_assessments
for insert
to authenticated
with check (
  assessed_by = (select auth.uid())
  and private.can_write_rider_pathway(academy_id, rider_user_id)
);

create policy rider_pathway_assessments_update_admin_or_author
on public.rider_pathway_assessments
for update
to authenticated
using (
  private.has_academy_role(
    academy_id,
    array['academy_admin']::public.app_role[]
  )
  or (
    assessed_by = (select auth.uid())
    and private.can_write_rider_pathway(academy_id, rider_user_id)
  )
)
with check (
  private.has_academy_role(
    academy_id,
    array['academy_admin']::public.app_role[]
  )
  or (
    assessed_by = (select auth.uid())
    and private.can_write_rider_pathway(academy_id, rider_user_id)
  )
);

revoke all on public.rider_pathway_assessments from anon, authenticated;
grant select on public.rider_pathway_assessments to authenticated;
grant insert (
  academy_id,
  rider_user_id,
  grade,
  outcome,
  safety_score,
  balance_score,
  control_score,
  confidence_score,
  summary,
  next_focus,
  assessed_at,
  assessed_by
) on public.rider_pathway_assessments to authenticated;
grant update (
  grade,
  outcome,
  safety_score,
  balance_score,
  control_score,
  confidence_score,
  summary,
  next_focus,
  assessed_at
) on public.rider_pathway_assessments to authenticated;

revoke all on type public.rider_pathway_outcome
  from public, anon, authenticated;
grant usage on type public.rider_pathway_outcome to authenticated;

revoke all on function private.can_access_rider_pathway(uuid, uuid)
  from public, anon;
grant execute on function private.can_access_rider_pathway(uuid, uuid)
  to authenticated;
revoke all on function private.can_write_rider_pathway(uuid, uuid)
  from public, anon;
grant execute on function private.can_write_rider_pathway(uuid, uuid)
  to authenticated;
revoke all on function private.validate_rider_pathway_assessment()
  from public, anon, authenticated;
revoke all on function private.touch_rider_pathway_updated_at()
  from public, anon, authenticated;

