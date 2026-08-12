-- Phase 0C.2A canonical operational configuration.
-- This file intentionally contains no production rows, auth identities, object
-- metadata, object contents, or secrets. Storage buckets are declared in
-- config.toml; only the non-secret pg_cron schedule is reproduced here.

select cron.schedule(
  'equivista-continuous-controls-daily',
  '15 2 * * *',
  $$select private.run_continuous_controls_monitoring('scheduled');$$
);
