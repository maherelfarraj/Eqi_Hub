select 'memberships' as object, count(*)::bigint as row_count from public.memberships
union all select 'payment_methods', count(*) from public.payment_methods
union all select 'invoices', count(*) from public.invoices
union all select 'invoice_lines', count(*) from public.invoice_lines
union all select 'video_analyses', count(*) from public.video_analyses
union all select 'lessons', count(*) from public.lessons
union all select 'horses', count(*) from public.horses
union all select 'horse_riders', count(*) from public.horse_riders
order by object;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('memberships', 'payment_methods', 'invoices', 'invoice_lines')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('memberships', 'payment_methods', 'video_analyses', 'horses', 'horse_riders')
order by tablename, policyname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'videos';
