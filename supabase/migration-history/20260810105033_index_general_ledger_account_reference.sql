begin;

create index if not exists gl_lines_account_idx
  on public.gl_journal_lines(account_id);

commit;
