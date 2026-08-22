-- Run after the canonical replay path on a disposable Supabase branch only.
-- This suite is transactional and leaves no fixture rows behind.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('b2100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-b21@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Batch 21 Admin"}', now(), now()),
  ('b2100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rider-b21@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Batch 21 Rider"}', now(), now()),
  ('b2100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invitee-b21@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Batch 21 Invitee"}', now(), now()),
  ('b2100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wrong-b21@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Wrong Invitee"}', now(), now()),
  ('b2100000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-admin-b21@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Other Admin"}', now(), now());

update public.profiles
set role = 'admin'
where id in (
  'b2100000-0000-0000-0000-000000000001',
  'b2100000-0000-0000-0000-000000000005'
);

insert into public.organizations (id, name, slug, organization_type, created_by) values
  ('b2110000-0000-0000-0000-000000000001', 'Batch 21 Academy', 'batch-21-academy', 'academy', 'b2100000-0000-0000-0000-000000000001'),
  ('b2110000-0000-0000-0000-000000000002', 'Other Batch 21 Academy', 'other-batch-21-academy', 'academy', 'b2100000-0000-0000-0000-000000000005');

insert into public.organization_memberships (id, organization_id, user_id, status, joined_at) values
  ('b2120000-0000-0000-0000-000000000001', 'b2110000-0000-0000-0000-000000000001', 'b2100000-0000-0000-0000-000000000001', 'active', now()),
  ('b2120000-0000-0000-0000-000000000002', 'b2110000-0000-0000-0000-000000000001', 'b2100000-0000-0000-0000-000000000002', 'active', now()),
  ('b2120000-0000-0000-0000-000000000003', 'b2110000-0000-0000-0000-000000000002', 'b2100000-0000-0000-0000-000000000005', 'active', now());

insert into public.organization_member_roles (membership_id, role) values
  ('b2120000-0000-0000-0000-000000000001', 'academy_admin'),
  ('b2120000-0000-0000-0000-000000000002', 'rider'),
  ('b2120000-0000-0000-0000-000000000003', 'academy_admin');

select set_config('request.jwt.claim.sub', 'b2100000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $rider_denials$
begin
  begin
    perform public.preview_academy_onboarding(
      'b2110000-0000-0000-0000-000000000001',
      '[{"email":"new@example.test","fullName":"New Rider","roles":["rider"]}]'::jsonb
    );
    raise exception 'rider previewed academy onboarding';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.academy_onboarding_invitations;
    raise exception 'direct invitation table read was allowed';
  exception when insufficient_privilege then null;
  end;
end
$rider_denials$;

reset role;
select set_config('request.jwt.claim.sub', 'b2100000-0000-0000-0000-000000000001', true);
set local role authenticated;

do $admin_boundaries$
declare
  preview jsonb;
begin
  preview := public.preview_academy_onboarding(
    'b2110000-0000-0000-0000-000000000001',
    '[{"email":"invitee-b21@example.test","fullName":"Batch 21 Invitee","roles":["rider"]}]'::jsonb
  );
  if not (preview->>'valid')::boolean then
    raise exception 'valid onboarding preview failed';
  end if;

  begin
    perform public.preview_academy_onboarding(
      'b2110000-0000-0000-0000-000000000002',
      '[{"email":"new@example.test","fullName":"New Rider","roles":["rider"]}]'::jsonb
    );
    raise exception 'academy admin crossed tenant boundary';
  exception when insufficient_privilege then null;
  end;
end
$admin_boundaries$;

create temporary table batch21_tokens on commit drop as
select * from public.create_academy_onboarding_batch(
  'b2110000-0000-0000-0000-000000000001',
  'Acceptance batch',
  '[
    {"email":"invitee-b21@example.test","fullName":"Batch 21 Invitee","roles":["rider"]},
    {"email":"wrong-b21@example.test","fullName":"Wrong Invitee","roles":["guardian"]}
  ]'::jsonb,
  7
);

reset role;
select set_config('request.jwt.claim.sub', 'b2100000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'b2100000-0000-0000-0000-000000000004',
    'role', 'authenticated',
    'email', 'wrong-b21@example.test'
  )::text,
  true
);
set local role authenticated;
do $wrong_email$
begin
  begin
    perform public.claim_academy_onboarding_invitation(
      (select invite_token from batch21_tokens where email = 'invitee-b21@example.test')
    );
    raise exception 'wrong email claimed invitation';
  exception when insufficient_privilege then null;
  end;
end
$wrong_email$;

reset role;
update public.profiles
set email = 'invitee-b21@example.test'
where id = 'b2100000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.sub', 'b2100000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'b2100000-0000-0000-0000-000000000004',
    'role', 'authenticated',
    'email', 'wrong-b21@example.test'
  )::text,
  true
);
set local role authenticated;
do $tampered_profile_email$
begin
  begin
    perform public.claim_academy_onboarding_invitation(
      (select invite_token from batch21_tokens where email = 'invitee-b21@example.test')
    );
    raise exception 'tampered profile email claimed invitation';
  exception when insufficient_privilege then null;
  end;
end
$tampered_profile_email$;

reset role;
select set_config('request.jwt.claim.sub', 'b2100000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'b2100000-0000-0000-0000-000000000003',
    'role', 'authenticated',
    'email', 'invitee-b21@example.test'
  )::text,
  true
);
set local role authenticated;
select public.claim_academy_onboarding_invitation(
  (select invite_token from batch21_tokens where email = 'invitee-b21@example.test')
);

do $one_time$
begin
  if not exists (
    select 1 from public.organization_memberships as membership
    join public.organization_member_roles as role on role.membership_id = membership.id
    where membership.organization_id = 'b2110000-0000-0000-0000-000000000001'
      and membership.user_id = 'b2100000-0000-0000-0000-000000000003'
      and membership.status = 'active'
      and role.role = 'rider'
  ) then
    raise exception 'valid invitation did not create rider membership';
  end if;

  begin
    perform public.claim_academy_onboarding_invitation(
      (select invite_token from batch21_tokens where email = 'invitee-b21@example.test')
    );
    raise exception 'invitation token was reusable';
  exception when no_data_found then null;
  end;
end
$one_time$;

reset role;
select set_config('request.jwt.claim.sub', 'b2100000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.close_academy_onboarding_batch(
  'b2110000-0000-0000-0000-000000000001',
  (select id from public.get_academy_onboarding_batches(
    'b2110000-0000-0000-0000-000000000001'
  ) where name = 'Acceptance batch')
);

do $closed$
begin
  if exists (
    select 1 from public.get_academy_onboarding_invitations(
      'b2110000-0000-0000-0000-000000000001',
      (select id from public.get_academy_onboarding_batches(
        'b2110000-0000-0000-0000-000000000001'
      ) where name = 'Acceptance batch')
    ) where email = 'wrong-b21@example.test' and status = 'pending'
  ) then
    raise exception 'pending invitation survived batch closure';
  end if;

  if exists (
    select 1 from public.audit_events
    where action like 'onboarding.%'
      and (
        coalesce(after_data::text, '') like '%@example.test%'
        or coalesce(after_data::text, '') ~ '[a-f0-9]{64}'
      )
  ) then
    raise exception 'onboarding audit leaked email or token';
  end if;
end
$closed$;

rollback;
