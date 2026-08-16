# Batch 10 — Offline Annotation Adjudication and Versioned Dataset Export

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 10 completes the Phase 2 annotation-quality foundation by turning Batch
9 annotation decisions into deterministic adjudication records and immutable,
versioned dataset-export manifests. No annotation may enter an export unless it
has accepted Batch 9 evidence or a complete qualified-review adjudication.

## Inputs

- Batch 8 source, window, and dataset-split lineage;
- Batch 9 skeleton version, annotation evidence, agreement metrics, and
  decision;
- synthetic adjudicator references for review-required annotations;
- the committed annotation-guide and export-contract versions.

## Adjudication contract

- `accepted` Batch 9 evidence may proceed without modification;
- `review-required` evidence must record an explicit `accept`, `correct`, or
  `exclude` outcome and a stable reason code;
- `rejected` Batch 9 evidence cannot be adjudicated into an export;
- corrections must retain the original evidence reference and receive a new
  deterministic evidence reference;
- the adjudicator must be distinct from both original reviewers;
- unresolved limb identity, visibility, or lineage ambiguity fails closed.

## Export contract

Every export pins:

- dataset, skeleton, annotation-guide, and export-contract versions;
- source/window/annotation/adjudication lineage;
- the Batch 8 train, validation, test, or golden assignment;
- ordered normalized keypoints, visibility states, and whole-horse box;
- deterministic content hashes and an immutable manifest hash.

Related horse, rider, arena, camera, recording-session, and source-video groups
must retain their Batch 8 partition. An export must reject duplicate evidence,
cross-partition lineage, missing adjudications, and personal or secret fields.

## Decisions

- `exportable`: all evidence and partition rules pass;
- `review-required`: structurally valid evidence still needs adjudication;
- `excluded`: rejected, unresolved, duplicated, or lineage-unsafe evidence;
- `invalid`: malformed configuration or manifest fails closed.

## Acceptance plan

The implementation will add:

1. a portable Batch 10 JSON schema and synthetic example manifest;
2. a deterministic adjudication and export-manifest evaluator;
3. regression coverage for reviewer independence, corrected-evidence lineage,
   duplicate evidence, partition drift, unresolved reviews, canonical hashing,
   and sensitive-field rejection;
4. verifier, package scripts, and Frontend CI integration alongside Batches
   6–9.

Required gates:

```bash
pnpm verify:batch10
pnpm test:batch10
pnpm typecheck
pnpm build
```

## Safety and privacy boundary

- offline synthetic fixtures only;
- no production footage, identifiers, credentials, medical data, or account
  references;
- no model training, pose inference, coaching output, or user-visible result;
- no database migration, Supabase Storage change, deployment, or production
  configuration change;
- no Batch 5 account, membership, link, document, signature, or audit-event
  mutation through August 22, 2026;
- no medical, veterinary, performance, or injury claim.

## Exit criteria

- every export row has complete Batch 8–10 lineage;
- every review-required annotation is adjudicated or excluded;
- corrected evidence is immutable and traceable to its original reviews;
- partition assignments cannot drift or cross related-source boundaries;
- exports contain no sensitive keys or production references;
- all Batch 6–10 gates, typecheck, and build pass.
