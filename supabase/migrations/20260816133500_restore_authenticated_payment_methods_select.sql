-- Restore the minimum Data API privilege required by the existing
-- payment_methods_select_own RLS policy.
grant select on table public.payment_methods to authenticated;
