begin;

create or replace function public.get_academy_report(
  target_academy_id uuid,
  target_starts_on date,
  target_ends_on date,
  target_currency text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  academy_tz text;
  normalized_currency text := upper(target_currency);
  start_at timestamptz;
  end_at timestamptz;
  report jsonb;
begin
  if actor is null
    or not private.has_academy_role(
      target_academy_id,
      array['academy_admin']::public.app_role[]
    )
  then
    raise exception 'Academy Admin access required' using errcode = '42501';
  end if;

  if target_ends_on < target_starts_on
    or target_ends_on - target_starts_on > 366
    or normalized_currency !~ '^[A-Z]{3}$'
  then
    raise exception 'Invalid report filters' using errcode = '22023';
  end if;

  select timezone into academy_tz
  from public.academies
  where id = target_academy_id;

  if academy_tz is null then
    raise exception 'Academy not found' using errcode = 'P0002';
  end if;

  start_at := target_starts_on::timestamp at time zone academy_tz;
  end_at := (target_ends_on + 1)::timestamp at time zone academy_tz;

  select jsonb_build_object(
    'academy_id', target_academy_id,
    'starts_on', target_starts_on,
    'ends_on', target_ends_on,
    'currency', normalized_currency,
    'financial', jsonb_build_object(
      'invoiced_minor', coalesce((select sum(amount_minor) from public.invoices where academy_id=target_academy_id and currency=normalized_currency and issued_at>=start_at and issued_at<end_at and status<>'void'),0),
      'paid_minor', coalesce((select sum(amount_minor) from public.invoices where academy_id=target_academy_id and currency=normalized_currency and settled_at>=start_at and settled_at<end_at and status='paid'),0),
      'outstanding_minor', coalesce((select sum(amount_minor) from public.invoices where academy_id=target_academy_id and currency=normalized_currency and status in ('issued','overdue')),0),
      'cash_received_minor', coalesce((select sum(amount_minor) from public.cash_receipts where academy_id=target_academy_id and currency=normalized_currency and received_at>=start_at and received_at<end_at),0),
      'cash_expenses_minor', coalesce((select sum(amount_minor) from public.cash_expenses where academy_id=target_academy_id and currency=normalized_currency and incurred_at>=start_at and incurred_at<end_at),0),
      'payroll_minor', coalesce((select sum(i.amount_minor) from public.payroll_items i join public.payroll_periods p on p.id=i.payroll_period_id where i.academy_id=target_academy_id and i.currency=normalized_currency and p.starts_on>=target_starts_on and p.ends_on<=target_ends_on),0)
    ),
    'operations', jsonb_build_object(
      'lessons_total', (select count(*) from public.lesson_sessions where academy_id=target_academy_id and starts_at>=start_at and starts_at<end_at),
      'lessons_completed', (select count(*) from public.lesson_sessions where academy_id=target_academy_id and starts_at>=start_at and starts_at<end_at and status='completed'),
      'lessons_cancelled', (select count(*) from public.lesson_sessions where academy_id=target_academy_id and starts_at>=start_at and starts_at<end_at and status='cancelled'),
      'attendance_attended', (select count(*) from public.lesson_bookings b join public.lesson_sessions l on l.id=b.lesson_session_id where b.academy_id=target_academy_id and l.starts_at>=start_at and l.starts_at<end_at and b.status='attended'),
      'attendance_no_show', (select count(*) from public.lesson_bookings b join public.lesson_sessions l on l.id=b.lesson_session_id where b.academy_id=target_academy_id and l.starts_at>=start_at and l.starts_at<end_at and b.status='no_show'),
      'active_riders', (select count(*) from public.academy_memberships where academy_id=target_academy_id and role='rider' and status='active'),
      'active_coaches', (select count(*) from public.academy_memberships where academy_id=target_academy_id and role='coach' and status='active')
    ),
    'development', jsonb_build_object(
      'lesson_reports', (select count(*) from public.lesson_reports where academy_id=target_academy_id and created_at>=start_at and created_at<end_at),
      'pathway_assessments', (select count(*) from public.rider_pathway_assessments where academy_id=target_academy_id and assessed_at>=start_at and assessed_at<end_at),
      'average_grade', coalesce((select round(avg(grade)::numeric,1) from public.rider_pathway_assessments where academy_id=target_academy_id and assessed_at>=start_at and assessed_at<end_at),0)
    ),
    'welfare', jsonb_build_object(
      'checks_total', (select count(*) from public.horse_welfare_checks where academy_id=target_academy_id and checked_at>=start_at and checked_at<end_at),
      'attention_checks', (select count(*) from public.horse_welfare_checks where academy_id=target_academy_id and checked_at>=start_at and checked_at<end_at and condition_flag<>'clear'),
      'horses_active', (select count(*) from public.horses where academy_id=target_academy_id and status<>'retired')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', day::date,
        'lessons', (select count(*) from public.lesson_sessions l where l.academy_id=target_academy_id and l.starts_at >= (day::date::timestamp at time zone academy_tz) and l.starts_at < ((day::date+1)::timestamp at time zone academy_tz)),
        'cash_received_minor', coalesce((select sum(c.amount_minor) from public.cash_receipts c where c.academy_id=target_academy_id and c.currency=normalized_currency and c.received_at >= (day::date::timestamp at time zone academy_tz) and c.received_at < ((day::date+1)::timestamp at time zone academy_tz)),0),
        'cash_expenses_minor', coalesce((select sum(e.amount_minor) from public.cash_expenses e where e.academy_id=target_academy_id and e.currency=normalized_currency and e.incurred_at >= (day::date::timestamp at time zone academy_tz) and e.incurred_at < ((day::date+1)::timestamp at time zone academy_tz)),0)
      ) order by day), '[]'::jsonb)
      from generate_series(target_starts_on,target_ends_on,interval '1 day') day
    )
  ) into report;

  return report;
end;
$$;

create or replace function public.record_academy_report_export(
  target_academy_id uuid,
  target_starts_on date,
  target_ends_on date,
  target_currency text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null
    or not private.has_academy_role(target_academy_id,array['academy_admin']::public.app_role[])
  then
    raise exception 'Academy Admin access required' using errcode='42501';
  end if;
  if target_ends_on < target_starts_on or target_ends_on-target_starts_on>366 or upper(target_currency)!~'^[A-Z]{3}$' then
    raise exception 'Invalid report filters' using errcode='22023';
  end if;
  perform public.write_audit_event(target_academy_id,'academy_report.exported','academy',target_academy_id,jsonb_build_object('starts_on',target_starts_on,'ends_on',target_ends_on,'currency',upper(target_currency)));
  return true;
end;
$$;

revoke all on function public.get_academy_report(uuid,date,date,text),public.record_academy_report_export(uuid,date,date,text) from public,anon;
grant execute on function public.get_academy_report(uuid,date,date,text),public.record_academy_report_export(uuid,date,date,text) to authenticated;
commit;
