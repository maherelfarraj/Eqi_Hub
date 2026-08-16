# Batch 7 — Offline Capture-Quality Preflight

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 7 implements a deterministic, offline gate that rejects unsuitable horse–rider footage before expensive analysis. It extends the accepted Batch 6 feasibility package without changing the production pipeline or exposing new results to pilot users.

## Decisions

- `eligible`: all required measurements and source-metadata guarantees pass.
- `shadow-only`: footage passes, but jumping footage below the recommended 60 FPS is restricted to human-reviewed shadow evaluation.
- `rejected`: one or more fail-closed rejection codes are present; expensive processing must not begin.

## Checks

The evaluator covers frame rate, resolution, horse and rider visibility, blur, lighting, camera stability, side-on angle, jump-plane visibility, and preservation of source timestamps, variable-frame-rate metadata, original aspect ratio, and source resolution.

Every outcome is deterministic. Malformed or non-finite measurements are rejected rather than coerced. Rejections return stable codes suitable for future operator guidance without making medical, veterinary, or performance claims.

## Safety and privacy boundaries

- offline synthetic fixtures only;
- no credentials, personal identifiers, production videos, or production metadata;
- no user-visible result or production model integration;
- no expensive processing after rejection;
- shadow outcomes require human review;
- no database migration, Storage change, deployment, or Batch 5 cohort mutation.

## Acceptance

```bash
node scripts/verify-batch7-capture-quality.mjs intelligence/batch7-capture-quality.example.json
node --test scripts/test-batch7-capture-quality.mjs
```

Frontend CI runs these checks together with the Batch 5 observation and Batch 6 feasibility gates.
