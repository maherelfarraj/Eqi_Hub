begin;
create index staff_hourly_rates_staff_user_idx on public.staff_hourly_compensation_rates (staff_user_id);
commit;
