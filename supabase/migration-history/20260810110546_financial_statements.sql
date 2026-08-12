begin;

create function public.get_financial_statements(target_academy_id uuid,target_starts_on date,target_ends_on date,target_currency text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid());normalized_currency text:=upper(btrim(target_currency));prior_starts_on date;prior_ends_on date;result jsonb;
begin
 if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 if target_starts_on is null or target_ends_on is null or target_ends_on<target_starts_on or target_ends_on-target_starts_on>731 or normalized_currency!~'^[A-Z]{3}$' then raise exception 'invalid financial statement range' using errcode='22023';end if;
 prior_ends_on:=target_starts_on-1;prior_starts_on:=prior_ends_on-(target_ends_on-target_starts_on);
 with periods(period_key,starts_on,ends_on) as(values('current'::text,target_starts_on,target_ends_on),('prior'::text,prior_starts_on,prior_ends_on)),
 account_rollup as(
  select period.period_key,period.starts_on,period.ends_on,account.id,account.code,account.name,account.category,account.normal_balance,account.system_key,
   coalesce(sum(case when entry.entry_date<period.starts_on then case when account.normal_balance='debit' then line.debit_minor-line.credit_minor else line.credit_minor-line.debit_minor end else 0 end),0)::bigint opening_minor,
   coalesce(sum(case when entry.entry_date between period.starts_on and period.ends_on then case when account.normal_balance='debit' then line.debit_minor-line.credit_minor else line.credit_minor-line.debit_minor end else 0 end),0)::bigint period_minor,
   coalesce(sum(case when entry.entry_date<=period.ends_on then case when account.normal_balance='debit' then line.debit_minor-line.credit_minor else line.credit_minor-line.debit_minor end else 0 end),0)::bigint closing_minor
  from periods period cross join public.gl_accounts account
  left join public.gl_journal_lines line on line.account_id=account.id
  left join public.gl_journal_entries entry on entry.id=line.journal_entry_id and entry.currency=normalized_currency and entry.entry_date<=period.ends_on and entry.status in('posted','reversed')
  where account.academy_id=target_academy_id group by period.period_key,period.starts_on,period.ends_on,account.id
 ),
 period_summary as(
  select period.period_key,period.starts_on,period.ends_on,
   coalesce(sum(rollup.period_minor)filter(where rollup.category='revenue'),0)::bigint revenue_minor,
   coalesce(sum(rollup.period_minor)filter(where rollup.category='expense'),0)::bigint expense_minor,
   coalesce(sum(rollup.closing_minor)filter(where rollup.category='asset'),0)::bigint assets_minor,
   coalesce(sum(rollup.closing_minor)filter(where rollup.category='liability'),0)::bigint liabilities_minor,
   coalesce(sum(rollup.closing_minor)filter(where rollup.category='equity'),0)::bigint equity_minor,
   coalesce(sum(rollup.closing_minor)filter(where rollup.category='revenue'),0)::bigint cumulative_revenue_minor,
   coalesce(sum(rollup.closing_minor)filter(where rollup.category='expense'),0)::bigint cumulative_expense_minor,
   coalesce(sum(rollup.opening_minor)filter(where rollup.system_key='cash'),0)::bigint opening_cash_minor,
   coalesce(sum(rollup.closing_minor)filter(where rollup.system_key='cash'),0)::bigint closing_cash_minor,
   coalesce(jsonb_agg(jsonb_build_object('id',rollup.id,'code',rollup.code,'name',rollup.name,'category',rollup.category,'amount_minor',rollup.period_minor)order by rollup.code)filter(where rollup.category in('revenue','expense')),'[]'::jsonb) pnl_accounts,
   coalesce(jsonb_agg(jsonb_build_object('id',rollup.id,'code',rollup.code,'name',rollup.name,'category',rollup.category,'amount_minor',rollup.closing_minor)order by rollup.code)filter(where rollup.category in('asset','liability','equity')),'[]'::jsonb) balance_accounts
  from periods period left join account_rollup rollup on rollup.period_key=period.period_key group by period.period_key,period.starts_on,period.ends_on
 ),
 cash_entries as(
  select period.period_key,entry.id,
   sum(case when account.system_key='cash' then line.debit_minor-line.credit_minor else 0 end)::bigint cash_delta_minor,
   bool_or(account.category in('liability','equity')) financing,
   bool_or(account.category='asset' and coalesce(account.system_key,'') not in('cash','accounts_receivable','suspense')) investing
  from periods period join public.gl_journal_entries entry on entry.academy_id=target_academy_id and entry.currency=normalized_currency and entry.entry_date between period.starts_on and period.ends_on and entry.status in('posted','reversed')
  join public.gl_journal_lines line on line.journal_entry_id=entry.id join public.gl_accounts account on account.id=line.account_id
  group by period.period_key,entry.id having sum(case when account.system_key='cash' then line.debit_minor-line.credit_minor else 0 end)<>0
 ),
 cash_summary as(
  select period.period_key,
   coalesce(sum(case when cash.financing then 0 when cash.investing then 0 else cash.cash_delta_minor end),0)::bigint operating_minor,
   coalesce(sum(case when not cash.financing and cash.investing then cash.cash_delta_minor else 0 end),0)::bigint investing_minor,
   coalesce(sum(case when cash.financing then cash.cash_delta_minor else 0 end),0)::bigint financing_minor
  from periods period left join cash_entries cash on cash.period_key=period.period_key group by period.period_key
 ),statement_rows as(
  select summary.*,cash.operating_minor,cash.investing_minor,cash.financing_minor,
   summary.revenue_minor-summary.expense_minor net_income_minor,
   summary.cumulative_revenue_minor-summary.cumulative_expense_minor retained_earnings_minor,
   summary.liabilities_minor+summary.equity_minor+(summary.cumulative_revenue_minor-summary.cumulative_expense_minor) liabilities_equity_minor
  from period_summary summary join cash_summary cash using(period_key)
 )
 select jsonb_build_object('starts_on',target_starts_on,'ends_on',target_ends_on,'currency',normalized_currency,'generated_at',now(),
  'current',(select jsonb_build_object('starts_on',starts_on,'ends_on',ends_on,'revenue_minor',revenue_minor,'expense_minor',expense_minor,'net_income_minor',net_income_minor,'pnl_accounts',pnl_accounts,'assets_minor',assets_minor,'liabilities_minor',liabilities_minor,'equity_minor',equity_minor,'retained_earnings_minor',retained_earnings_minor,'liabilities_equity_minor',liabilities_equity_minor,'balance_sheet_balanced',assets_minor=liabilities_equity_minor,'balance_accounts',balance_accounts,'opening_cash_minor',opening_cash_minor,'operating_cash_flow_minor',operating_minor,'investing_cash_flow_minor',investing_minor,'financing_cash_flow_minor',financing_minor,'net_cash_change_minor',operating_minor+investing_minor+financing_minor,'closing_cash_minor',closing_cash_minor)from statement_rows where period_key='current'),
  'prior',(select jsonb_build_object('starts_on',starts_on,'ends_on',ends_on,'revenue_minor',revenue_minor,'expense_minor',expense_minor,'net_income_minor',net_income_minor,'pnl_accounts',pnl_accounts,'assets_minor',assets_minor,'liabilities_minor',liabilities_minor,'equity_minor',equity_minor,'retained_earnings_minor',retained_earnings_minor,'liabilities_equity_minor',liabilities_equity_minor,'balance_sheet_balanced',assets_minor=liabilities_equity_minor,'balance_accounts',balance_accounts,'opening_cash_minor',opening_cash_minor,'operating_cash_flow_minor',operating_minor,'investing_cash_flow_minor',investing_minor,'financing_cash_flow_minor',financing_minor,'net_cash_change_minor',operating_minor+investing_minor+financing_minor,'closing_cash_minor',closing_cash_minor)from statement_rows where period_key='prior')) into result;
 return result;
end;$$;

create function public.record_financial_statement_export(target_academy_id uuid,target_starts_on date,target_ends_on date,target_currency text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 perform public.write_audit_event(target_academy_id,'financial_statements.exported','gl_journal_entry',null,jsonb_build_object('starts_on',target_starts_on,'ends_on',target_ends_on,'currency',upper(btrim(target_currency))));
end;$$;

revoke all on function public.get_financial_statements(uuid,date,date,text),public.record_financial_statement_export(uuid,date,date,text) from public,anon,authenticated;
grant execute on function public.get_financial_statements(uuid,date,date,text),public.record_financial_statement_export(uuid,date,date,text) to authenticated;

commit;
