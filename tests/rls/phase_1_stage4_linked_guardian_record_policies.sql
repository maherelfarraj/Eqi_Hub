-- Verify consolidated guardian reads and unchanged record write boundaries.
-- All fixtures and attempted writes are rolled back.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

do $topology$
declare
  affected_table text;
  command_name text;
  policy_count integer;
begin
  foreach affected_table in array array['documents', 'health_records', 'training_log']
  loop
    foreach command_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      select count(*)
      into policy_count
      from pg_policies
      where schemaname = 'public'
        and tablename = affected_table
        and permissive = 'PERMISSIVE'
        and 'authenticated' = any(roles)
        and cmd = command_name;

      if policy_count <> 1 then
        raise exception '% has % permissive authenticated % policies',
          affected_table,
          policy_count,
          command_name;
      end if;
    end loop;

    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = affected_table
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and (
          coalesce(qual, '') like '%can_access_horse%'
          or coalesce(with_check, '') like '%can_access_horse%'
        )
    ) then
      raise exception '% widened a write policy through can_access_horse',
        affected_table;
    end if;
  end loop;
end
$topology$;

do $fixture$
declare
  v_guardian_id uuid;
  v_rider_id uuid;
  v_horse_id uuid;
  v_document_id uuid;
  v_health_record_id uuid;
  v_training_log_id uuid;
begin
  select link.guardian_id, link.rider_id, horse.id
  into strict v_guardian_id, v_rider_id, v_horse_id
  from public.guardian_riders as link
  join public.horse_access_assignments as access
    on access.organization_id = link.organization_id
   and access.profile_id = link.rider_id
   and access.active
  join public.horses as horse on horse.id = access.horse_id
  where link.active
    and horse.owner_id is distinct from link.guardian_id
    and not exists (
      select 1
      from public.horse_riders as legacy
      where legacy.horse_id = horse.id
        and legacy.rider_id = link.guardian_id
    )
  limit 1;

  insert into public.documents (horse_id, user_id, name, url)
  values (v_horse_id, v_rider_id, 'Guardian policy fixture', 'about:blank')
  returning id into v_document_id;

  insert into public.health_records (horse_id, rec_type, summary)
  values (v_horse_id, 'Other', 'Guardian policy fixture')
  returning id into v_health_record_id;

  insert into public.training_log (horse_id, author_id, note)
  values (v_horse_id, v_rider_id, 'Guardian policy fixture')
  returning id into v_training_log_id;

  perform set_config('phase_1_stage4.guardian_id', v_guardian_id::text, true);
  perform set_config('phase_1_stage4.rider_id', v_rider_id::text, true);
  perform set_config('phase_1_stage4.horse_id', v_horse_id::text, true);
  perform set_config('phase_1_stage4.document_id', v_document_id::text, true);
  perform set_config('phase_1_stage4.health_record_id', v_health_record_id::text, true);
  perform set_config('phase_1_stage4.training_log_id', v_training_log_id::text, true);
end
$fixture$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('phase_1_stage4.guardian_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $guardian$
declare
  v_rider_id uuid := current_setting('phase_1_stage4.rider_id')::uuid;
  v_horse_id uuid := current_setting('phase_1_stage4.horse_id')::uuid;
  v_document_id uuid := current_setting('phase_1_stage4.document_id')::uuid;
  v_health_record_id uuid := current_setting('phase_1_stage4.health_record_id')::uuid;
  v_training_log_id uuid := current_setting('phase_1_stage4.training_log_id')::uuid;
  affected_rows integer;
begin
  if (select count(*) from public.documents where id = v_document_id) <> 1 then
    raise exception 'guardian cannot read the linked horse document';
  end if;
  if (select count(*) from public.health_records where id = v_health_record_id) <> 1 then
    raise exception 'guardian cannot read the linked horse health record';
  end if;
  if (select count(*) from public.training_log where id = v_training_log_id) <> 1 then
    raise exception 'guardian cannot read the linked horse training log';
  end if;

  update public.documents set name = name where id = v_document_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'guardian updated a linked horse document'; end if;

  update public.health_records set summary = summary where id = v_health_record_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'guardian updated a linked horse health record'; end if;

  update public.training_log set note = note where id = v_training_log_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'guardian updated a linked horse training log'; end if;

  delete from public.documents where id = v_document_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'guardian deleted a linked horse document'; end if;

  delete from public.health_records where id = v_health_record_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'guardian deleted a linked horse health record'; end if;

  delete from public.training_log where id = v_training_log_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'guardian deleted a linked horse training log'; end if;

  begin
    insert into public.documents (horse_id, user_id, name, url)
    values (v_horse_id, v_rider_id, 'Forbidden guardian insert', 'about:blank');
    raise exception 'guardian inserted a linked horse document';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.health_records (horse_id, rec_type)
    values (v_horse_id, 'Other');
    raise exception 'guardian inserted a linked horse health record';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.training_log (horse_id, author_id, note)
    values (v_horse_id, v_rider_id, 'Forbidden guardian insert');
    raise exception 'guardian inserted a linked horse training log';
  exception when insufficient_privilege then null;
  end;
end
$guardian$;

reset role;
rollback;
