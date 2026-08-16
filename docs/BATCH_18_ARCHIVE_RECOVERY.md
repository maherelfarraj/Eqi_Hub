# Batch 18 — Offline Archive-Recovery Drill

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 18 proves that approved Batch 17 evidence can be reconstructed and
verified in a bounded offline drill without mounting, downloading, or mutating
production systems.

## Contract

- pin the approved Batch 17 archive hash;
- require an exact recovery scope and complete hash matches;
- require independent records and audit operators;
- enforce a bounded drill duration;
- disable destructive restore, external download, writeback, and release.

## Safety boundary

The drill uses synthetic offline evidence only. It performs no Supabase,
database, Storage, production-data, deployment, or Batch 5 cohort mutation
through August 22, 2026.

## Exit criteria

- archive lineage and recovery scope are reproducible;
- every requested object is independently hash-verified;
- time and mutation controls pass;
- all Batch 6–18 tests, typecheck, and build pass.
