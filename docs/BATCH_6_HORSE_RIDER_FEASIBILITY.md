# Batch 6 — Horse–Rider Intelligence Feasibility and Safety Foundation

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 6 turns Phase 0 of the Horse–Rider Intelligence plan into an executable,
offline acceptance contract. It defines which recordings may proceed to later
research, which must remain shadow-only, and which must be rejected before
expensive processing.

## Safety boundary

- No Batch 6 result is visible to a production or pilot user.
- Medical diagnosis and injury prediction are prohibited.
- Veterinary or movement-irregularity language always requires qualified human
  review.
- Low-confidence or unsuitable footage produces an unavailable or rejected
  result, never a confident-looking coaching claim.
- Every future finding must retain observable evidence and require human review.

## Capture contract

General coaching footage requires at least 30 FPS and 720-pixel frame height.
Jump-event timing recommends at least 60 FPS. Both horse and rider must remain
visible. Severe blur, unstable capture, missing subjects, or an invisible jump
plane fail closed before paid processing.

## Dataset governance

The committed golden-set manifest contains synthetic references and metadata
only. It stores no footage, credentials, account identifiers, names, contact
details, or medical data. Consent, guardian consent for minors, separate
dataset-use opt-in, retention, deletion, and commercial dependency licensing
are mandatory gates. Train, validation, and test partitions must be separated
by video, horse, rider, arena, and recording session.

`intelligence/batch6-feasibility.schema.json` documents the portable manifest
contract. The executable validator enforces stricter cross-field safety rules.

## Acceptance

```bash
pnpm verify:batch6
pnpm test:batch6
pnpm typecheck
pnpm build
pnpm verify:pilot
pnpm test:pilot
```

The validator rejects production data, user-visible output, diagnostic claims,
weak capture rules, missing evidence, optional human review, sensitive fields,
and leaking golden-set boundaries.

## Exclusions

Batch 6 adds no migration, production data, production model, live inference,
payment workflow, registration change, or pilot-cohort change. The accepted
production analysis pipeline remains the rollback and comparison path.
