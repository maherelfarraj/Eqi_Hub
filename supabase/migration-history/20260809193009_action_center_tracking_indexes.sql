begin;

create index action_center_tracking_updated_by_idx
  on public.action_center_tracking (updated_by);

commit;
