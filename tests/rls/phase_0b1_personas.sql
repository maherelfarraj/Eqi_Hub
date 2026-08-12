-- Run after Phase 0A.2 and Phase 0B.1 on the disposable development branch.
-- The fixture data is transactional and leaves no rows behind.

begin;

insert into public.profiles (id, email, full_name, role) values
  ('90000000-0000-0000-0000-000000000001', 'guardian@example.test', 'Guardian Fixture', 'rider'),
  ('90000000-0000-0000-0000-000000000002', 'outsider@example.test', 'Outsider Fixture', 'rider');

insert into public.organizations (id, name, slug, organization_type, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'EquiVista Academy', 'equivista-academy', 'academy', '30000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000002', 'Other Academy', 'other-academy', 'academy', '40000000-0000-0000-0000-000000000004');

insert into public.organization_memberships (
  id, organization_id, user_id, status, joined_at
) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active', now()),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'active', now()),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'active', now()),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'active', now()),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'active', now()),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'active', now());

insert into public.organization_member_roles (membership_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'rider'),
  ('b0000000-0000-0000-0000-000000000002', 'coach'),
  ('b0000000-0000-0000-0000-000000000003', 'academy_admin'),
  ('b0000000-0000-0000-0000-000000000003', 'horse_owner'),
  ('b0000000-0000-0000-0000-000000000004', 'guardian'),
  ('b0000000-0000-0000-0000-000000000005', 'academy_admin'),
  ('b0000000-0000-0000-0000-000000000006', 'rider');

insert into public.platform_role_assignments (user_id, role)
values ('40000000-0000-0000-0000-000000000004', 'platform_admin');

update public.horses
set organization_id = 'a0000000-0000-0000-0000-000000000001'
where id = '50000000-0000-0000-0000-000000000001';

update public.video_analyses
set organization_id = 'a0000000-0000-0000-0000-000000000001'
where id = '70000000-0000-0000-0000-000000000001';

update public.lessons
set organization_id = 'a0000000-0000-0000-0000-000000000001'
where id = '80000000-0000-0000-0000-000000000001';

update public.memberships
set organization_id = 'a0000000-0000-0000-0000-000000000001'
where id = '60000000-0000-0000-0000-000000000002';

update public.invoices
set organization_id = 'a0000000-0000-0000-0000-000000000001'
where id = '60000000-0000-0000-0000-000000000004';

insert into public.guardian_riders (organization_id, guardian_id, rider_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.coach_rider_assignments (organization_id, coach_id, rider_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.horse_access_assignments (
  organization_id, horse_id, profile_id, access_type
) values (
  'a0000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'rider'
);

insert into public.audit_events (
  organization_id, source, actor_user_id, entity_type, entity_id, action
) values (
  'a0000000-0000-0000-0000-000000000001',
  'application',
  '30000000-0000-0000-0000-000000000003',
  'organization_membership',
  'b0000000-0000-0000-0000-000000000001',
  'fixture.created'
);

insert into public.notification_outbox (
  organization_id, recipient_id, channel, subject
) values (
  'a0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'in_app',
  'Fixture notification'
);

-- Cross-tenant constraints must reject mismatched organization relationships.
do $constraints$
begin
  begin
    insert into public.guardian_riders (organization_id, guardian_id, rider_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002'
    );
    raise exception 'cross-tenant guardian assignment succeeded';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.horse_access_assignments (
      organization_id, horse_id, profile_id, access_type
    ) values (
      'a0000000-0000-0000-0000-000000000002',
      '50000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002',
      'rider'
    );
    raise exception 'cross-tenant horse access succeeded';
  exception when foreign_key_violation then null;
  end;
end
$constraints$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $rider$
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'rider organization visibility failed';
  end if;
  if (select count(*) from public.organization_memberships) <> 1 then
    raise exception 'rider membership visibility failed';
  end if;
  if (select count(*) from public.organization_member_roles) <> 1 then
    raise exception 'rider role visibility failed';
  end if;
  if (select count(*) from public.guardian_riders) <> 1 then
    raise exception 'rider guardian visibility failed';
  end if;
  if (select count(*) from public.coach_rider_assignments) <> 1 then
    raise exception 'rider coach visibility failed';
  end if;
  if (select count(*) from public.horse_access_assignments) <> 1 then
    raise exception 'rider horse access visibility failed';
  end if;
  if (select count(*) from public.audit_events) <> 0 then
    raise exception 'rider saw audit events';
  end if;
  if (select count(*) from public.notification_outbox) <> 1 then
    raise exception 'rider notification visibility failed';
  end if;
  begin
    insert into public.organization_member_roles (membership_id, role)
    values ('b0000000-0000-0000-0000-000000000001', 'academy_admin');
    raise exception 'rider could assign own organization role';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.audit_events (
      organization_id, source, entity_type, action
    ) values (
      'a0000000-0000-0000-0000-000000000001',
      'application',
      'test',
      'spoofed'
    );
    raise exception 'rider could spoof an audit event';
  exception when insufficient_privilege then null;
  end;
end
$rider$;

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $coach$
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'coach organization visibility failed';
  end if;
  if (select count(*) from public.coach_rider_assignments) <> 1 then
    raise exception 'coach assignment visibility failed';
  end if;
  if (select count(*) from public.guardian_riders) <> 0 then
    raise exception 'coach saw guardian relationships';
  end if;
end
$coach$;

reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $academy_admin$
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'academy admin organization visibility failed';
  end if;
  if (select count(*) from public.organization_memberships) <> 4 then
    raise exception 'academy admin member visibility failed';
  end if;
  if (select count(*) from public.organization_member_roles) <> 5 then
    raise exception 'academy admin role visibility failed';
  end if;
  if (select count(*) from public.audit_events) <> 1 then
    raise exception 'academy admin audit visibility failed';
  end if;
  if (select count(*) from public.notification_outbox) <> 1 then
    raise exception 'academy admin notification visibility failed';
  end if;
  begin
    update public.organization_memberships set status = 'suspended';
    raise exception 'academy admin browser role could mutate memberships';
  exception when insufficient_privilege then null;
  end;
end
$academy_admin$;

reset role;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $guardian$
begin
  if (select count(*) from public.guardian_riders) <> 1 then
    raise exception 'guardian rider visibility failed';
  end if;
  if (select count(*) from public.coach_rider_assignments) <> 0 then
    raise exception 'guardian saw coach assignments';
  end if;
end
$guardian$;

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
set local role authenticated;
do $platform_admin$
begin
  if (select count(*) from public.organizations) <> 2 then
    raise exception 'platform admin organization visibility failed';
  end if;
  if (select count(*) from public.organization_memberships) <> 6 then
    raise exception 'platform admin membership visibility failed';
  end if;
  if (select count(*) from public.audit_events) <> 1 then
    raise exception 'platform admin audit visibility failed';
  end if;
end
$platform_admin$;

reset role;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $other_tenant$
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'other tenant organization visibility failed';
  end if;
  if (select count(*) from public.audit_events) <> 0 then
    raise exception 'other tenant saw audit events';
  end if;
  if (select count(*) from public.guardian_riders) <> 0 then
    raise exception 'other tenant saw guardian links';
  end if;
end
$other_tenant$;

reset role;
rollback;
