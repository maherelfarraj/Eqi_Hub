begin;

create index monitoring_exceptions_control_idx on public.continuous_monitoring_exceptions(control_id);
create index monitoring_exceptions_created_by_idx on public.continuous_monitoring_exceptions(created_by) where created_by is not null;
create index monitoring_exceptions_resolved_by_idx on public.continuous_monitoring_exceptions(resolved_by) where resolved_by is not null;
create index monitoring_exceptions_updated_by_idx on public.continuous_monitoring_exceptions(updated_by) where updated_by is not null;
create index monitoring_rules_created_by_idx on public.continuous_monitoring_rules(created_by) where created_by is not null;
create index monitoring_rules_updated_by_idx on public.continuous_monitoring_rules(updated_by) where updated_by is not null;

commit;
