# Batch 12 — Offline Training Experiment Preflight

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 12 turns an approved Batch 11 dataset release into a deterministic,
reviewable experiment preflight. It specifies how an offline pose-estimation
experiment could run later without executing training now.

## Contract

- recompute and pin the complete approved Batch 11 release manifest;
- reserve `train` for optimization and `validation` for selection;
- keep `test` and `golden` isolated as holdouts;
- pin architecture, objective, seed, epochs, batch size, learning rate,
  augmentations, and resource estimates;
- reject missing determinism, split leakage, or resource-limit breaches;
- emit an immutable reproducibility hash while keeping execution unauthorized.

## Safety boundary

This preflight uses synthetic offline evidence only. It performs no training,
inference, production-data access, outbound networking, deployment, database
or Storage changes, and no Batch 5 cohort mutation through August 22, 2026.

## Exit criteria

- Batch 11 release integrity is reproducible;
- all split roles are disjoint and complete;
- the plan is deterministic and within resource ceilings;
- execution and outbound networking remain disabled;
- all Batch 6–12 tests, typecheck, and build pass.
