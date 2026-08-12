begin;

create or replace function private.refresh_cost_center_entry(target_entry_id uuid)
returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare scoped_entry public.gl_journal_entries%rowtype;source record;rule record;inserted integer:=0;source_amount bigint;
begin
 if (select auth.uid()) is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 select * into scoped_entry from public.gl_journal_entries where id=target_entry_id;if not found or scoped_entry.status not in('posted','reversed') then return 0;end if;
 delete from public.cost_center_allocations allocation where allocation.journal_entry_id=scoped_entry.id;
 for source in select line.id line_id,line.account_id,account.category,account.normal_balance,line.debit_minor,line.credit_minor from public.gl_journal_lines line join public.gl_accounts account on account.id=line.account_id where line.journal_entry_id=scoped_entry.id and account.category in('revenue','expense') loop
  source_amount:=case when source.normal_balance='debit' then source.debit_minor-source.credit_minor else source.credit_minor-source.debit_minor end;
  for rule in select allocation_rule.id,allocation_rule.cost_center_id,allocation_rule.allocation_bps from public.cost_center_allocation_rules allocation_rule join public.cost_centers center on center.id=allocation_rule.cost_center_id where allocation_rule.account_id=source.account_id and allocation_rule.academy_id=scoped_entry.academy_id and center.active and allocation_rule.effective_from<=scoped_entry.entry_date and (allocation_rule.effective_to is null or allocation_rule.effective_to>=scoped_entry.entry_date) order by allocation_rule.id loop
   insert into public.cost_center_allocations(academy_id,journal_entry_id,journal_line_id,account_id,cost_center_id,rule_id,entry_date,currency,source_amount_minor,allocated_minor,allocation_bps)
   values(scoped_entry.academy_id,scoped_entry.id,source.line_id,source.account_id,rule.cost_center_id,rule.id,scoped_entry.entry_date,scoped_entry.currency,source_amount,round(source_amount*rule.allocation_bps/10000.0)::bigint,rule.allocation_bps);inserted:=inserted+1;
  end loop;
 end loop;return inserted;
end;
$$;

grant execute on function private.refresh_cost_center_entry(uuid) to authenticated;

commit;
