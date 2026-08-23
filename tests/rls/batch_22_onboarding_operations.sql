-- Run after the canonical replay path on a disposable Supabase branch only.
-- This suite is transactional and leaves no fixture rows behind.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('b2200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-b22@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Batch 22 Admin"}', now(), now()),
  ('b2200000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rider-b22@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Batch 22 Rider"}', now(), now()),
  ('b2200000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invitee-b22@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Batch 22 Invitee"}', now(), now());

update public.profiles set role = 'admin'
where id = 'b2200000-0000-0000-0000-000000000001';

insert into public.organizations (id, name, slug, organization_type, created_by)
values ('b2210000-0000-0000-0000-000000000001', 'Batch 22 Academy', 'batch-22-academy', 'academy', 'b2200000-0000-0000-0000-000000000001');

insert into public.organization_memberships (id, organization_id, user_id, status, joined_at) values
  ('b2220000-0000-0000-0000-000000000001', 'b2210000-0000-0000-0000-000000000001', 'b2200000-0000-0000-0000-000000000001', 'active', now()),
  ('b2220000-0000-0000-0000-000000000002', 'b2210000-0000-0000-0000-000000000001', 'b2200000-0000-0000-0000-000000000002', 'active', now());

insert into public.organization_member_roles (membership_id, role) values
  ('b2220000-0000-0000-0000-000000000001', 'academy_admin'),
  ('b2220000-0000-0000-0000-000000000002', 'rider');

select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-000000000001', true);
set local role authenticated;

create temporary table batch22_tokens on commit drop as
select * from public.create_academy_onboarding_batch(
  'b2210000-0000-0000-0000-000000000001',
  'Operations batch',
  '[{"email":"invitee-b22@example.test","fullName":"Batch 22 Invitee","roles":["rider"]}]'::jsonb,
  7
);

create temporary table batch22_batch on commit drop as
select id from public.get_academy_onboarding_batches(
  'b2210000-0000-0000-0000-000000000001'
) where name = 'Operations batch';

reset role;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-000000000002', true);
set local role authenticated;

do $rider_denials$
begin
  begin
    perform * from public.get_academy_onboarding_metrics('b2210000-0000-0000-0000-000000000001');
    raise exception 'rider read onboarding metrics';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.get_academy_onboarding_activity('b2210000-0000-0000-0000-000000000001', 25);
    raise exception 'rider read onboarding activity';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.get_academy_onboarding_invitations(
      'b2210000-0000-0000-0000-000000000001',
      (select id from batch22_batch)
    );
    raise exception 'rider read onboarding invitations';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.reissue_academy_onboarding_invitation(
      'b2210000-0000-0000-0000-000000000001',
      (select invitation_id from batch22_tokens),
      'operator_request'
    );
    raise exception 'rider replaced onboarding invitation';
  exception when insufficient_privilege then null;
  end;
end
$rider_denials$;

reset role;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-000000000001', true);
set local role authenticated;

do $metrics_before$
declare
  metrics record;
begin
  select * into metrics from public.get_academy_onboarding_metrics(
    'b2210000-0000-0000-0000-000000000001'
  );
  if metrics.total_batches <> 1
     or metrics.active_batches <> 1
     or metrics.pending_invitations <> 1
     or metrics.accepted_invitations <> 0 then
    raise exception 'onboarding metrics were incorrect before replacement';
  end if;
end
$metrics_before$;

create temporary table batch22_replacement on commit drop as
select * from public.reissue_academy_onboarding_invitation(
  'b2210000-0000-0000-0000-000000000001',
  (select invitation_id from batch22_tokens),
  'operator_request'
);

do $rotation_and_cooldown$
begin
  if (select invite_token from batch22_replacement) = (select invite_token from batch22_tokens) then
    raise exception 'replacement token did not rotate';
  end if;
  begin
    perform * from public.reissue_academy_onboarding_invitation(
      'b2210000-0000-0000-0000-000000000001',
      (select invitation_id from batch22_tokens),
      'not_received'
    );
    raise exception 'replacement cooldown was bypassed';
  exception when check_violation then null;
  end;
end
$rotation_and_cooldown$;

reset role;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'b2200000-0000-0000-0000-000000000003',
    'role', 'authenticated',
    'email', 'invitee-b22@example.test'
  )::text,
  true
);
set local role authenticated;
do $old_token_invalidated$
begin
  begin
    perform public.claim_academy_onboarding_invitation(
      (select invite_token from batch22_tokens)
    );
    raise exception 'old invitation token remained valid';
  exception when no_data_found then null;
  end;
end
$old_token_invalidated$;

reset role;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-000000000001', true);
set local role authenticated;

select public.revoke_academy_onboarding_invitation(
  'b2210000-0000-0000-0000-000000000001',
  (select invitation_id from batch22_tokens)
);

do $final_state$
declare
  metrics record;
begin
  select * into metrics from public.get_academy_onboarding_metrics(
    'b2210000-0000-0000-0000-000000000001'
  );
  if metrics.pending_invitations <> 0
     or metrics.revoked_invitations <> 1
     or metrics.replacement_links_generated <> 1 then
    raise exception 'final onboarding metrics were incorrect';
  end if;
  if not exists (
    select 1 from public.get_academy_onboarding_activity(
      'b2210000-0000-0000-0000-000000000001', 25
    ) where action = 'onboarding.invitation_reissued'
  ) then
    raise exception 'replacement audit activity was missing';
  end if;
  if exists (
    select 1 from public.audit_events
    where action = 'onboarding.invitation_reissued'
      and (
        coalesce(after_data::text, '') like '%@example.test%'
        or coalesce(after_data::text, '') ~ '[a-f0-9]{64}'
      )
  ) then
    raise exception 'replacement audit leaked email or token';
  end if;
end
$final_state$;

rollback;
