do $assertions$
begin
  if has_table_privilege('authenticated', 'public.memberships', 'INSERT')
     or has_table_privilege('authenticated', 'public.memberships', 'UPDATE')
     or has_table_privilege('authenticated', 'public.payment_methods', 'DELETE')
     or has_table_privilege('authenticated', 'public.invoices', 'UPDATE') then
    raise exception 'commercial browser write privilege remains';
  end if;

  if has_column_privilege('authenticated', 'public.payment_methods', 'provider_token', 'SELECT')
     or not has_column_privilege('authenticated', 'public.payment_methods', 'last4', 'SELECT') then
    raise exception 'payment method column boundary is incorrect';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'videos' and public = false
      and file_size_limit = 524288000
      and allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm']::text[]
  ) then
    raise exception 'videos bucket hardening missing';
  end if;

  if to_regprocedure('private.is_horse_owner(uuid)') is null
     or to_regprocedure('private.is_horse_rider(uuid)') is null
     or to_regprocedure('public.is_horse_owner(uuid)') is not null
     or to_regprocedure('public.is_horse_rider(uuid)') is not null then
    raise exception 'horse helper isolation is incorrect';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'set_updated_at')
      and not (p.proconfig @> array['search_path=""']::text[])
  ) then
    raise exception 'modified public function has a mutable search path';
  end if;
end
$assertions$;

select 'memberships' as object, count(*)::bigint as row_count from public.memberships
union all select 'payment_methods', count(*) from public.payment_methods
union all select 'invoices', count(*) from public.invoices
union all select 'invoice_lines', count(*) from public.invoice_lines
union all select 'video_analyses', count(*) from public.video_analyses
union all select 'lessons', count(*) from public.lessons
union all select 'horses', count(*) from public.horses
union all select 'horse_riders', count(*) from public.horse_riders
order by object;
