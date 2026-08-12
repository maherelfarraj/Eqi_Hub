-- Run after the Phase 0A.2 migration on the disposable development branch.
-- Each block acts as a current canonical persona via JWT claim simulation.

begin;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $rider$
declare visible_count integer;
begin
  select count(*) into visible_count from public.memberships;
  if visible_count <> 1 then raise exception 'rider membership read failed'; end if;

  select count(*) into visible_count from public.payment_methods;
  if visible_count <> 1 then raise exception 'rider safe payment-method read failed'; end if;

  begin
    execute 'select provider_token from public.payment_methods';
    raise exception 'rider could read provider_token';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.memberships set status = 'cancelled';
    raise exception 'rider could update membership';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.invoices set status = 'paid';
    raise exception 'rider could settle invoice';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.payment_methods;
    raise exception 'rider could delete payment method';
  exception when insufficient_privilege then null;
  end;

  select count(*) into visible_count from public.horses;
  if visible_count <> 1 then raise exception 'linked rider horse read failed'; end if;
end
$rider$;

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $trainer$
declare visible_count integer;
begin
  select count(*) into visible_count from public.video_analyses;
  if visible_count <> 1 then raise exception 'assigned trainer analysis read failed'; end if;
  if (select count(*) from public.memberships) <> 0 then
    raise exception 'trainer saw unrelated membership';
  end if;
end
$trainer$;

reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $owner$
begin
  if (select count(*) from public.horses) <> 1 then
    raise exception 'owner horse read failed';
  end if;
  if (select count(*) from public.video_analyses) <> 0 then
    raise exception 'owner saw unrelated analysis';
  end if;
end
$owner$;

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
set local role authenticated;
do $admin$
begin
  if (select count(*) from public.memberships) <> 0 then
    raise exception 'admin bypassed current membership RLS';
  end if;
  begin
    insert into public.memberships (id, user_id, plan_id, status)
    values (gen_random_uuid(), '40000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', 'active');
    raise exception 'admin browser role could insert membership';
  exception when insufficient_privilege then null;
  end;
end
$admin$;

reset role;
rollback;
