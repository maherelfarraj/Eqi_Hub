# Batch 17 — Offline Tamper-Evident Evidence Archive

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 17 seals approved Batch 16 decision evidence into a deterministic,
tamper-evident offline archive with custody, retention, and verification
receipts. It cannot authorize or perform a release.

## Contract

- pin the approved Batch 16 decision hash;
- require a complete deterministic evidence bundle;
- require independent records and safety custodians;
- require bounded retention and successful hash verification;
- keep deletion, external upload, deployment, and user traffic disabled.

## Safety boundary

The archive is synthetic and offline. It performs no production-data access,
Supabase, database, Storage, deployment, or Batch 5 cohort mutation through
August 22, 2026.

## Exit criteria

- decision lineage is reproducible;
- custody, retention, and verification controls pass;
- archive and release mutation remain disabled;
- all Batch 6–17 tests, typecheck, and build pass.
