# Batch 13 — Offline Synthetic Experiment Evidence and Evaluation

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 13 validates synthetic dry-run evidence for a Batch 12 experiment plan.
It evaluates provenance and metrics without executing training or inference and
without promoting an artifact.

## Contract

- recompute the Batch 12 preflight and compare it with an independently pinned
  approved hash;
- require deterministic run, artifact, environment, and dependency evidence;
- use validation only for selection and keep test and golden sealed;
- enforce minimum keypoint-correctness, maximum mean error, sample coverage,
  and validation-to-test gap thresholds;
- emit immutable evaluation evidence while keeping promotion unauthorized.

## Safety boundary

The package uses synthetic offline receipts only. It performs no real training,
model inference, production-data access, deployment, database or Storage
changes, and no Batch 5 cohort mutation through August 22, 2026.

## Exit criteria

- Batch 12 lineage and run provenance are reproducible;
- holdouts remain isolated;
- quality and overfit thresholds pass;
- no execution or user-visible result is enabled;
- all Batch 6–13 tests, typecheck, and build pass.
