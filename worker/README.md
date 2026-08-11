# EquiVista analysis worker

Railway worker for `video_analyses`. It polls every 30 seconds, atomically claims
rows whose status is `uploaded`, runs the deterministic Phase 3 pipeline, and
writes `score`, `metrics`, `ai_feedback`, and status `analyzed`. Pipeline errors
set status to `failed`.

The frame extraction, normalized pose estimation, and feedback stages are
deterministic runnable stubs. Each stage contains an `mp-3` TODO where the real
media/model implementation will replace the stub without changing the worker
lifecycle.

## Required environment

Set these only in Railway or your local shell. Never expose the service-role
key to the Vite application.

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
```

Optional:

```text
POLL_INTERVAL_MS=30000
PORT=3000
```

## Local verification

```bash
corepack enable
pnpm install --ignore-workspace --frozen-lockfile
pnpm --ignore-workspace typecheck
pnpm --ignore-workspace test
pnpm --ignore-workspace build
pnpm --ignore-workspace dev
```

Insert a `video_analyses` row for a real rider with status `uploaded`. The
worker should log a claim/completion and update that row to `analyzed` during
the next poll. `GET /health` returns worker health while it is running.

## Railway deployment

1. Create a Railway service from the `Eqi_Hub` GitHub repository.
2. Set **Root Directory** to `/worker`.
3. Railway will build the included `Dockerfile`.
4. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as service variables.
5. Deploy and confirm `/health` returns `{"status":"ok",...}`.
6. Insert a test row with status `uploaded`; confirm the deploy logs report
   completion and the database row becomes `analyzed`.

The service-role key is intentionally server-only. It bypasses RLS and must
never be copied into Replit/Vite `VITE_*` variables or committed to Git.
