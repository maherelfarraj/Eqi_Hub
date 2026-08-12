begin;

create table public.lesson_reports (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  lesson_session_id uuid not null unique
    references public.lesson_sessions(id) on delete restrict,
  rider_user_id uuid not null references auth.users(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  summary text not null,
  achievements text,
  next_focus text not null,
  effort_score smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_reports_summary_length
    check (char_length(btrim(summary)) between 10 and 2000),
  constraint lesson_reports_achievements_length
    check (
      achievements is null
      or char_length(btrim(achievements)) between 1 and 1500
    ),
  constraint lesson_reports_next_focus_length
    check (char_length(btrim(next_focus)) between 3 and 1500),
  constraint lesson_reports_effort_score_range
    check (effort_score between 1 and 5)
);

create index lesson_reports_academy_rider_created_idx
  on public.lesson_reports (academy_id, rider_user_id, created_at desc);
create index lesson_reports_rider_idx
  on public.lesson_reports (rider_user_id);
create index lesson_reports_author_idx
  on public.lesson_reports (author_user_id);

comment on table public.lesson_reports is
  'Rider-visible progress reports attached to completed academy lessons.';

create function private.can_access_lesson_report(
  target_lesson_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lesson_sessions lesson
    where lesson.id = target_lesson_session_id
      and private.can_access_lesson_session(
        lesson.academy_id,
        lesson.coach_user_id,
        lesson.rider_user_id
      )
  );
$$;

create function private.can_write_lesson_report(
  target_lesson_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lesson_sessions lesson
    where lesson.id = target_lesson_session_id
      and lesson.status = 'completed'::public.lesson_status
      and lesson.rider_user_id is not null
      and (
        private.has_academy_role(
          lesson.academy_id,
          array['academy_admin']::public.app_role[]
        )
        or (
          lesson.coach_user_id = (select auth.uid())
          and private.has_academy_role(
            lesson.academy_id,
            array['coach']::public.app_role[]
          )
        )
      )
  );
$$;

create function private.validate_lesson_report_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson public.lesson_sessions%rowtype;
begin
  select *
  into lesson
  from public.lesson_sessions
  where id = new.lesson_session_id;

  if lesson.id is null then
    raise exception 'Lesson does not exist'
      using errcode = '23514';
  end if;

  if lesson.academy_id <> new.academy_id
    or lesson.rider_user_id is null
    or lesson.rider_user_id <> new.rider_user_id
  then
    raise exception 'Report must match the lesson academy and assigned rider'
      using errcode = '23514';
  end if;

  if lesson.status <> 'completed'::public.lesson_status then
    raise exception 'Progress reports require a completed lesson'
      using errcode = '23514';
  end if;

  if new.author_user_id <> (select auth.uid())
    or not private.can_write_lesson_report(new.lesson_session_id)
  then
    raise exception 'Only the Academy Admin or assigned coach may write this report'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function private.touch_lesson_report_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lesson_reports_validate_scope
before insert or update of academy_id, lesson_session_id, rider_user_id, author_user_id
on public.lesson_reports
for each row execute function private.validate_lesson_report_scope();

create trigger lesson_reports_touch_updated_at
before update on public.lesson_reports
for each row execute function private.touch_lesson_report_updated_at();

alter table public.lesson_reports enable row level security;

create policy lesson_reports_select_scoped
on public.lesson_reports
for select
to authenticated
using (
  private.can_access_lesson_report(lesson_session_id)
);

create policy lesson_reports_insert_admins_or_assigned_coaches
on public.lesson_reports
for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and private.can_write_lesson_report(lesson_session_id)
);

create policy lesson_reports_update_admins_or_assigned_coaches
on public.lesson_reports
for update
to authenticated
using (
  private.can_write_lesson_report(lesson_session_id)
)
with check (
  private.can_write_lesson_report(lesson_session_id)
);

revoke all on public.lesson_reports from anon, authenticated;
grant select on public.lesson_reports to authenticated;
grant insert (
  academy_id,
  lesson_session_id,
  rider_user_id,
  author_user_id,
  summary,
  achievements,
  next_focus,
  effort_score
) on public.lesson_reports to authenticated;
grant update (
  summary,
  achievements,
  next_focus,
  effort_score
) on public.lesson_reports to authenticated;

revoke all on function private.can_access_lesson_report(uuid)
  from public, anon;
grant execute on function private.can_access_lesson_report(uuid)
  to authenticated;
revoke all on function private.can_write_lesson_report(uuid)
  from public, anon;
grant execute on function private.can_write_lesson_report(uuid)
  to authenticated;
revoke all on function private.validate_lesson_report_scope()
  from public, anon, authenticated;
revoke all on function private.touch_lesson_report_updated_at()
  from public, anon, authenticated;

commit;
