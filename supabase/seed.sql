-- Phase 0C.4 reproducible operational configuration.
-- This file intentionally contains no production rows, auth identities, object
-- metadata, object contents, or secrets. Storage buckets are declared in
-- config.toml; only the non-secret pg_cron schedule is reproduced here.
--
-- Remove any prior job with the stable name before scheduling it so this seed
-- remains safe when a disposable environment is reset or reseeded.
do $seed$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'equivista-continuous-controls-daily'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'equivista-continuous-controls-daily',
    '15 2 * * *',
    $cron$select private.run_continuous_controls_monitoring('scheduled');$cron$
  );
end
$seed$;
