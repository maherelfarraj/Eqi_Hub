begin;

grant update(vat_tax_code_id,net_amount_minor,tax_amount_minor,updated_at) on public.invoices to authenticated;
create policy invoices_update_platform_administrators
on public.invoices for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()));

commit;
