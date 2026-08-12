begin;

create or replace function private.allocate_cost_center_on_post()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status in ('posted','reversed') and old.status is distinct from new.status then
    perform private.refresh_cost_center_entry(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.allocate_cost_center_on_post() from public, anon, authenticated;

commit;
