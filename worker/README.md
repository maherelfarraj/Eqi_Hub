# EquiVista analysis worker

Railway worker for `video_analyses`. It polls every 30 seconds, atomically claims
rows whose status is `uploaded`, analyzes the video, and writes `score`,
`metrics`, `ai_feedback`, and status `analyzed`. Validation errors set status to
`failed` without writing analysis metrics.

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
PIPELINE_MODE=llm
LLM_PROVIDER=openai
LLM_API_KEY=<server-only-provider-key>
LLM_MODEL=gpt-4o-mini
LLM_MAX_RETRIES=2
LLM_TIMEOUT_MS=120000
MAX_VIDEO_MB=300
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

## Real pipeline (Phase 6)

`PIPELINE_MODE=llm` (the default) downloads the private video, extracts four to
twelve chronological JPEG frames with ffmpeg, and asks the configured vision
model for a discipline-aware riding rubric. `openai`, `anthropic`, and `gemini`
providers are supported through the same validated output contract.

`PIPELINE_MODE=stub` restores the deterministic Phase 3 pipeline for instant
rollback. A transient provider or network failure also falls back to that stub
and emits an `llm_fallback` operator log. Validation failures do not fall back:
missing, oversized, unreadable, and non-riding videos remain `failed`, so they
cannot receive fabricated metrics.

Provider keys belong only in Railway variables. The worker logs the provider,
model, latency, token counts, known estimated cost, frame-cited evidence, and
overall coaching comment. It never logs the API key or video bytes.
