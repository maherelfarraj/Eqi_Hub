begin;
do $fix$
declare definition text;
begin
  select pg_get_functiondef(
    'public.get_academy_report(uuid,date,date,text)'::regprocedure
  ) into definition;
  if position('status=''active''' in definition) > 0 then
    execute replace(
      definition,
      'status=''active''',
      'status<>''retired'''
    );
  end if;
end;
$fix$;
commit;
