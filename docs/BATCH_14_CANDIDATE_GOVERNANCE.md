# Batch 14 — Offline Candidate Governance and Model Card

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 14 converts approved Batch 13 synthetic evaluation evidence into a
reviewable candidate model card and governance record without authorizing any
release or deployment.

## Contract

- pin the independently approved Batch 13 evaluation hash;
- document offline-only intended use, limitations, and prohibited uses;
- require risk severity and mitigation references;
- require independent ML and safety approvals;
- require explicit fail-closed rollback triggers and ownership;
- emit immutable governance evidence while keeping release unauthorized.

## Safety boundary

No shadow release, deployment, user-visible result, production-data access,
database or Storage change, or Batch 5 cohort mutation through August 22, 2026.

## Exit criteria

- evaluation lineage is pinned;
- model-card limitations and prohibitions are complete;
- independent reviews and rollback controls pass;
- release remains disabled;
- all Batch 6–14 tests, typecheck, and build pass.
