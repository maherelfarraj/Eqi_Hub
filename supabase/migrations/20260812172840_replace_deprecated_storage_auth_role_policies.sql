begin;

alter policy storage_user_delete_own
on storage.objects
to authenticated
using (
  (storage.foldername(name))[1] = (select auth.uid())::text
);

alter policy storage_user_read_own
on storage.objects
to authenticated
using (
  (storage.foldername(name))[1] = (select auth.uid())::text
);

alter policy storage_user_update_own
on storage.objects
to authenticated
using (
  (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  (storage.foldername(name))[1] = (select auth.uid())::text
);

alter policy storage_user_upload
on storage.objects
to authenticated
with check (
  (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
