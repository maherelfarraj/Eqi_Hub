begin;

create or replace function public.update_audit_finding(target_finding_id uuid, target_status text, target_root_cause text, target_management_response text, target_owner_user_id uuid, target_date date) returns boolean language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.audit_findings%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_status not in ('open','in_progress','ready_for_review') then raise exception 'open finding status required' using errcode='22023'; end if;
  select * into scoped from public.audit_findings where id=target_finding_id and status<>'closed' for update; if scoped.id is null then raise exception 'open audit finding required' using errcode='23514'; end if;
  update public.audit_findings set status=target_status,root_cause=nullif(btrim(target_root_cause),''),management_response=nullif(btrim(target_management_response),''),owner_user_id=target_owner_user_id,target_date=$6,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'audit_finding.updated','audit_finding',scoped.id,jsonb_build_object('status',target_status,'target_date',$6)); return true;
end; $$;

revoke all on function public.update_audit_finding(uuid,text,text,text,uuid,date) from public, anon, authenticated;
grant execute on function public.update_audit_finding(uuid,text,text,text,uuid,date) to authenticated;

commit;
