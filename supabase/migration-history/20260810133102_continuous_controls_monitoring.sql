begin;

create extension if not exists pg_cron;

alter table public.audit_findings alter column created_by drop not null;
alter table public.audit_findings alter column updated_by drop not null;
alter table public.audit_findings add column origin text not null default 'manual';
alter table public.audit_findings add column monitoring_exception_id uuid;
alter table public.audit_findings add constraint audit_finding_origin_allowed check(origin in('manual','automated'));
alter table public.audit_findings add constraint audit_finding_origin_authorship check((origin='manual' and created_by is not null and updated_by is not null)or origin='automated');

create table public.continuous_monitoring_rules(
 id uuid primary key default gen_random_uuid(),academy_id uuid not null references public.academies(id) on delete restrict,control_id uuid not null references public.audit_control_definitions(id) on delete restrict,
 rule_key text not null,title text not null,description text not null,threshold_days integer not null default 0,severity text not null,enabled boolean not null default true,owner_user_id uuid not null references auth.users(id),
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_by uuid references auth.users(id),updated_at timestamptz not null default now(),
 constraint monitoring_rule_key_allowed check(rule_key in('control_test_overdue','bank_unreconciled','supplier_payment_past_due','financial_close_overdue','vat_return_overdue')),
 constraint monitoring_rule_title_length check(char_length(title)between 5 and 180),constraint monitoring_rule_description_length check(char_length(description)between 10 and 1000),
 constraint monitoring_rule_threshold check(threshold_days between 0 and 120),constraint monitoring_rule_severity check(severity in('low','medium','high','critical')),unique(academy_id,rule_key)
);

create table public.continuous_monitoring_runs(
 id uuid primary key default gen_random_uuid(),trigger_type text not null,status text not null default 'running',started_at timestamptz not null default now(),finished_at timestamptz,
 rules_evaluated integer not null default 0,exceptions_detected integer not null default 0,new_findings_created integer not null default 0,error_message text,created_by uuid references auth.users(id),
 constraint monitoring_run_trigger check(trigger_type in('scheduled','manual')),constraint monitoring_run_status check(status in('running','completed','failed')),
 constraint monitoring_run_state check((status='running' and finished_at is null and error_message is null)or(status='completed' and finished_at is not null and error_message is null)or(status='failed' and finished_at is not null and char_length(error_message)between 2 and 1000))
);

create table public.continuous_monitoring_exceptions(
 id uuid primary key default gen_random_uuid(),rule_id uuid not null references public.continuous_monitoring_rules(id) on delete restrict,run_id uuid not null references public.continuous_monitoring_runs(id) on delete restrict,
 academy_id uuid not null references public.academies(id) on delete restrict,control_id uuid not null references public.audit_control_definitions(id) on delete restrict,source_entity_type text not null,source_entity_id uuid not null,
 detected_period date not null default date_trunc('month',current_date)::date,title text not null,details text not null,severity text not null,status text not null default 'open',occurrence_count integer not null default 1,
 first_detected_at timestamptz not null default now(),last_detected_at timestamptz not null default now(),assigned_to uuid not null references auth.users(id),triage_notes text,resolved_by uuid references auth.users(id),resolved_at timestamptz,
 finding_id uuid unique references public.audit_findings(id) on delete restrict,created_by uuid references auth.users(id),updated_by uuid references auth.users(id),updated_at timestamptz not null default now(),
 constraint monitoring_exception_source_length check(char_length(source_entity_type)between 2 and 80),constraint monitoring_exception_text check(char_length(title)between 5 and 180 and char_length(details)between 10 and 2000),
 constraint monitoring_exception_severity check(severity in('low','medium','high','critical')),constraint monitoring_exception_status check(status in('open','acknowledged','resolved')),constraint monitoring_exception_occurrences check(occurrence_count>0),
 constraint monitoring_exception_resolution check((status<>'resolved' and resolved_by is null and resolved_at is null)or(status='resolved' and resolved_by is not null and resolved_at is not null and char_length(triage_notes)between 10 and 2000)),
 unique(rule_id,source_entity_type,source_entity_id,detected_period)
);

alter table public.audit_findings add constraint audit_findings_monitoring_exception_fk foreign key(monitoring_exception_id) references public.continuous_monitoring_exceptions(id) on delete restrict;
create unique index audit_findings_monitoring_exception_unique on public.audit_findings(monitoring_exception_id)where monitoring_exception_id is not null;
create index monitoring_rules_academy_enabled_idx on public.continuous_monitoring_rules(academy_id,enabled,rule_key);create index monitoring_rules_control_idx on public.continuous_monitoring_rules(control_id);create index monitoring_rules_owner_idx on public.continuous_monitoring_rules(owner_user_id);
create index monitoring_runs_started_idx on public.continuous_monitoring_runs(started_at desc);create index monitoring_runs_created_by_idx on public.continuous_monitoring_runs(created_by)where created_by is not null;
create index monitoring_exceptions_academy_status_idx on public.continuous_monitoring_exceptions(academy_id,status,severity,last_detected_at desc);create index monitoring_exceptions_assigned_idx on public.continuous_monitoring_exceptions(assigned_to,status);create index monitoring_exceptions_rule_idx on public.continuous_monitoring_exceptions(rule_id,detected_period desc);create index monitoring_exceptions_run_idx on public.continuous_monitoring_exceptions(run_id);

alter table public.continuous_monitoring_rules enable row level security;alter table public.continuous_monitoring_runs enable row level security;alter table public.continuous_monitoring_exceptions enable row level security;
revoke all on public.continuous_monitoring_rules,public.continuous_monitoring_runs,public.continuous_monitoring_exceptions from public,anon,authenticated;
grant select,insert,update on public.continuous_monitoring_rules to authenticated;grant select on public.continuous_monitoring_runs to authenticated;grant select,update on public.continuous_monitoring_exceptions to authenticated;
grant select,insert,update,delete on public.continuous_monitoring_rules,public.continuous_monitoring_runs,public.continuous_monitoring_exceptions to service_role;
create policy monitoring_rules_read_administrators on public.continuous_monitoring_rules for select to authenticated using((select private.is_platform_administrator()));create policy monitoring_rules_insert_administrators on public.continuous_monitoring_rules for insert to authenticated with check((select private.is_platform_administrator())and created_by=(select auth.uid())and updated_by=(select auth.uid()));create policy monitoring_rules_update_administrators on public.continuous_monitoring_rules for update to authenticated using((select private.is_platform_administrator()))with check((select private.is_platform_administrator())and updated_by=(select auth.uid()));
create policy monitoring_runs_read_administrators on public.continuous_monitoring_runs for select to authenticated using((select private.is_platform_administrator()));
create policy monitoring_exceptions_read_administrators on public.continuous_monitoring_exceptions for select to authenticated using((select private.is_platform_administrator()));create policy monitoring_exceptions_update_administrators on public.continuous_monitoring_exceptions for update to authenticated using((select private.is_platform_administrator()))with check((select private.is_platform_administrator())and updated_by=(select auth.uid()));

create function private.protect_terminal_monitoring_run()returns trigger language plpgsql security invoker set search_path='' as $$begin if old.status in('completed','failed')then raise exception 'completed monitoring run is immutable' using errcode='23514';end if;return new;end;$$;
create trigger protect_terminal_monitoring_run before update or delete on public.continuous_monitoring_runs for each row execute function private.protect_terminal_monitoring_run();
create function private.protect_resolved_monitoring_exception()returns trigger language plpgsql security invoker set search_path='' as $$begin if old.status='resolved'then raise exception 'resolved monitoring exception is immutable' using errcode='23514';end if;new.updated_at:=now();return new;end;$$;
create trigger protect_resolved_monitoring_exception before update or delete on public.continuous_monitoring_exceptions for each row execute function private.protect_resolved_monitoring_exception();

with admin as(select user_id from public.platform_access where access_level='administrator' and status='active' order by created_at limit 1),seeded_controls as(
 insert into public.audit_control_definitions(academy_id,control_code,title,objective,procedure,control_type,frequency,owner_user_id,created_by,updated_by)
 select academy.id,'MON-001','Continuous operational control monitoring','Identify control failures quickly enough for accountable remediation.','Run daily data-driven checks, assign every exception, and require evidence-based closure.','detective','event_driven',admin.user_id,admin.user_id,admin.user_id from public.academies academy cross join admin where academy.archived_at is null
 on conflict(academy_id,control_code)do update set updated_at=public.audit_control_definitions.updated_at returning id,academy_id,owner_user_id,created_by
)
insert into public.continuous_monitoring_rules(academy_id,control_id,rule_key,title,description,threshold_days,severity,owner_user_id,created_by,updated_by)
select control.academy_id,control.id,rule.rule_key,rule.title,rule.description,rule.threshold_days,rule.severity,control.owner_user_id,control.created_by,control.created_by from seeded_controls control cross join(values
 ('control_test_overdue','Overdue control effectiveness test','A planned or in-progress control test remains incomplete after its due date.',0,'high'),
 ('bank_unreconciled','Unreconciled bank transaction','A bank statement line remains unmatched beyond the permitted reconciliation window.',7,'high'),
 ('supplier_payment_past_due','Approved supplier payment overdue','An approved supplier payment run has passed its scheduled execution date.',0,'critical'),
 ('financial_close_overdue','Monthly financial close overdue','An approved monthly budget remains without a locked close after the close deadline.',10,'high'),
 ('vat_return_overdue','VAT return overdue','A generated VAT return remains in draft beyond the filing window.',30,'critical')
)as rule(rule_key,title,description,threshold_days,severity)on conflict(academy_id,rule_key)do nothing;

create function private.run_continuous_controls_monitoring(target_trigger text default 'scheduled')returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());generated_run_id uuid;rule record;signal record;generated_exception_id uuid;generated_finding_id uuid;rules_count integer:=0;exceptions_count integer:=0;findings_count integer:=0;cycle date:=date_trunc('month',current_date)::date;
begin
 if target_trigger not in('scheduled','manual')then raise exception 'invalid monitoring trigger' using errcode='22023';end if;
 if actor is not null and not private.is_platform_administrator()then raise exception 'platform administrator access required' using errcode='42501';end if;
 if actor is null and session_user<>'postgres'then raise exception 'trusted scheduler required' using errcode='42501';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('equivista-continuous-controls',0))then raise exception 'continuous monitoring is already running' using errcode='55P03';end if;
 insert into public.continuous_monitoring_runs(trigger_type,status,created_by)values(target_trigger,'running',actor)returning id into generated_run_id;
 for rule in select * from public.continuous_monitoring_rules where enabled order by academy_id,rule_key loop
  rules_count:=rules_count+1;
  for signal in
   select * from(
    select 'audit_control_test'::text source_type,test.id source_id,('Overdue control test · '||control.control_code)::text title,('Control test due '||test.due_on||' remains '||test.status||'.')::text details
    from public.audit_control_tests test join public.audit_control_definitions control on control.id=test.control_id where rule.rule_key='control_test_overdue'and control.academy_id=rule.academy_id and test.status in('planned','in_progress')and test.due_on<current_date-rule.threshold_days
    union all select 'bank_statement_line',line.id,('Unreconciled bank line · '||line.account_label),('Transaction dated '||line.transaction_date||' for '||line.amount_minor||' '||line.currency||' remains unmatched.') from public.bank_statement_lines line where rule.rule_key='bank_unreconciled'and line.academy_id=rule.academy_id and line.status='unmatched'and line.transaction_date<current_date-rule.threshold_days
    union all select 'supplier_payment_run',pay.id,('Supplier payment overdue · '||pay.run_number),('Approved payment scheduled for '||pay.scheduled_on||' remains unpaid.') from public.supplier_payment_runs pay where rule.rule_key='supplier_payment_past_due'and pay.academy_id=rule.academy_id and pay.status='approved'and pay.scheduled_on<current_date-rule.threshold_days
    union all select 'academy_monthly_budget',budget.id,('Financial close overdue · '||budget.month_start),('Approved budget period '||budget.month_start||' has no completed financial close.') from public.academy_monthly_budgets budget where rule.rule_key='financial_close_overdue'and budget.academy_id=rule.academy_id and budget.status='approved'and current_date>(budget.month_start+interval '1 month'+make_interval(days=>rule.threshold_days))::date and not exists(select 1 from public.financial_close_periods close where close.budget_id=budget.id and close.status='closed')
    union all select 'vat_return',vat.id,('VAT return overdue · '||vat.period_ends_on),('VAT return ending '||vat.period_ends_on||' remains draft beyond the filing window.') from public.vat_returns vat where rule.rule_key='vat_return_overdue'and vat.academy_id=rule.academy_id and vat.status='draft'and current_date>vat.period_ends_on+rule.threshold_days
   )detected
  loop
   generated_exception_id:=null;generated_finding_id:=null;
   insert into public.continuous_monitoring_exceptions(rule_id,run_id,academy_id,control_id,source_entity_type,source_entity_id,detected_period,title,details,severity,assigned_to,created_by,updated_by)
   values(rule.id,generated_run_id,rule.academy_id,rule.control_id,signal.source_type,signal.source_id,cycle,signal.title,signal.details,rule.severity,rule.owner_user_id,actor,actor)
   on conflict(rule_id,source_entity_type,source_entity_id,detected_period)do update set run_id=excluded.run_id,last_detected_at=now(),occurrence_count=public.continuous_monitoring_exceptions.occurrence_count+1,updated_by=actor,updated_at=now()
   where public.continuous_monitoring_exceptions.status<>'resolved'
   returning id,finding_id into generated_exception_id,generated_finding_id;
   if generated_exception_id is null then continue;end if;
   exceptions_count:=exceptions_count+1;
   if generated_finding_id is null then
    insert into public.audit_findings(academy_id,control_id,severity,title,details,recommendation,owner_user_id,target_date,status,origin,monitoring_exception_id,created_by,updated_by)
    values(rule.academy_id,rule.control_id,rule.severity,signal.title,signal.details,'Investigate the source record, correct the control failure, retain evidence, and submit the remediation for review.',rule.owner_user_id,current_date+case rule.severity when'critical'then 3 when'high'then 7 when'medium'then 14 else 30 end,'open','automated',generated_exception_id,null,null)returning id into generated_finding_id;
    update public.continuous_monitoring_exceptions set finding_id=generated_finding_id where id=generated_exception_id;findings_count:=findings_count+1;
   end if;
  end loop;
 end loop;
 update public.continuous_monitoring_runs set status='completed',finished_at=now(),rules_evaluated=rules_count,exceptions_detected=exceptions_count,new_findings_created=findings_count where id=generated_run_id;
 return generated_run_id;
exception when others then
 if generated_run_id is not null then update public.continuous_monitoring_runs set status='failed',finished_at=now(),rules_evaluated=rules_count,exceptions_detected=exceptions_count,new_findings_created=findings_count,error_message=left(sqlerrm,1000)where id=generated_run_id;return generated_run_id;end if;raise;
end;$$;

create function public.run_continuous_monitoring_now()returns uuid language plpgsql security invoker set search_path='' as $$declare actor uuid:=(select auth.uid());run_id uuid;begin if actor is null or not private.is_platform_administrator()then raise exception 'platform administrator access required' using errcode='42501';end if;run_id:=private.run_continuous_controls_monitoring('manual');return run_id;end;$$;
create function public.save_continuous_monitoring_rule(target_rule_id uuid,target_threshold_days integer,target_severity text,target_enabled boolean,target_owner_user_id uuid)returns boolean language plpgsql security invoker set search_path='' as $$declare actor uuid:=(select auth.uid());scoped public.continuous_monitoring_rules%rowtype;begin if actor is null or not private.is_platform_administrator()then raise exception 'platform administrator access required' using errcode='42501';end if;select*into scoped from public.continuous_monitoring_rules where id=target_rule_id for update;if scoped.id is null then raise exception 'monitoring rule not found' using errcode='P0002';end if;update public.continuous_monitoring_rules set threshold_days=target_threshold_days,severity=target_severity,enabled=target_enabled,owner_user_id=target_owner_user_id,updated_by=actor,updated_at=now()where id=scoped.id;perform public.write_audit_event(scoped.academy_id,'continuous_monitoring.rule_saved','continuous_monitoring_rule',scoped.id,jsonb_build_object('threshold_days',target_threshold_days,'severity',target_severity,'enabled',target_enabled));return true;end;$$;
create function public.triage_monitoring_exception(target_exception_id uuid,target_status text,target_assigned_to uuid,target_triage_notes text)returns boolean language plpgsql security invoker set search_path='' as $$declare actor uuid:=(select auth.uid());scoped public.continuous_monitoring_exceptions%rowtype;notes text:=nullif(btrim(coalesce(target_triage_notes,'')),'');begin if actor is null or not private.is_platform_administrator()then raise exception 'platform administrator access required' using errcode='42501';end if;if target_status not in('open','acknowledged','resolved')or(target_status='resolved'and char_length(notes)not between 10 and 2000)then raise exception 'resolution evidence required' using errcode='22023';end if;select*into scoped from public.continuous_monitoring_exceptions where id=target_exception_id and status<>'resolved'for update;if scoped.id is null then raise exception 'open monitoring exception required' using errcode='23514';end if;update public.continuous_monitoring_exceptions set status=target_status,assigned_to=target_assigned_to,triage_notes=notes,resolved_by=case when target_status='resolved'then actor end,resolved_at=case when target_status='resolved'then now()end,updated_by=actor,updated_at=now()where id=scoped.id;if target_status='resolved'and scoped.finding_id is not null then update public.audit_findings set status='ready_for_review',root_cause=coalesce(root_cause,'Automated control exception required remediation.'),management_response=notes,updated_by=actor,updated_at=now()where id=scoped.finding_id and status<>'closed';end if;perform public.write_audit_event(scoped.academy_id,'continuous_monitoring.exception_'||target_status,'continuous_monitoring_exception',scoped.id,jsonb_build_object('finding_id',scoped.finding_id,'assigned_to',target_assigned_to));return true;end;$$;

revoke all on function private.protect_terminal_monitoring_run(),private.protect_resolved_monitoring_exception(),private.run_continuous_controls_monitoring(text)from public,anon,authenticated;
grant execute on function private.run_continuous_controls_monitoring(text)to authenticated;
revoke all on function public.run_continuous_monitoring_now(),public.save_continuous_monitoring_rule(uuid,integer,text,boolean,uuid),public.triage_monitoring_exception(uuid,text,uuid,text)from public,anon,authenticated;
grant execute on function public.run_continuous_monitoring_now(),public.save_continuous_monitoring_rule(uuid,integer,text,boolean,uuid),public.triage_monitoring_exception(uuid,text,uuid,text)to authenticated;

select cron.schedule('equivista-continuous-controls-daily','15 2 * * *',$$select private.run_continuous_controls_monitoring('scheduled');$$);

commit;
