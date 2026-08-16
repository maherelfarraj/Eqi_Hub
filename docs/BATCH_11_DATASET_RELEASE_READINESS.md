# Batch 11 — Offline Dataset Release Readiness

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 11 converts an immutable Batch 10 export into a deterministic offline
dataset-release readiness decision. It verifies the pinned export hash,
lineage, split isolation, content uniqueness, coverage, visibility quality, and
human approval evidence before producing a versioned release manifest.

## Contract

- accept the complete ordered Batch 10 manifest and recompute its exact hash;
- validate its version pins, ordered 23-point content, and row lineage;
- retain the four Batch 8 partitions and all six grouping boundaries;
- reject duplicate annotation references and duplicate content hashes;
- require minimum per-split, horse-group, and visible-keypoint coverage;
- require synthetic human release approval after all automatic checks pass;
- emit deterministic statistics and an immutable release-manifest hash;
- keep `training_authorized` false: readiness does not start training.

## Safety boundary

This package is synthetic and offline only. It performs no model training or
inference, production-data access, deployment, database or Storage changes,
and no Batch 5 cohort mutation through August 22, 2026.

## Exit criteria

- Batch 10 manifest integrity is pinned and reproducible;
- every row has complete Batch 8–10 lineage;
- no related group crosses a split and no content is duplicated;
- coverage and visibility thresholds pass;
- independent approval evidence is present;
- all Batch 6–11 tests, typecheck, and build pass.
