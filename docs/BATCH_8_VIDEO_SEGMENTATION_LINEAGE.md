# Batch 8 — Offline Video Segmentation and Dataset Lineage

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 8 converts footage accepted by the Batch 7 capture-quality gate into deterministic jump-window and dataset-split manifests. It preserves source evidence, rejects unsafe windows before inference, and prevents related clips from crossing train, validation, test, or golden partitions.

## Segmentation contract

- source timestamps must be finite, non-negative, and strictly increasing;
- source timestamps, variable-frame-rate metadata, aspect ratio, and resolution must remain preserved;
- every jump window keeps at least three strides before and two strides after the fence;
- start, takeoff, landing, and end timestamps must be ordered and inside the source bounds;
- overlapping windows fail closed;
- every accepted window and source manifest receives a deterministic SHA-256 lineage reference.

## Leakage prevention

Clips are joined into connected components whenever they share a source video, horse, rider, arena, camera, or recording session. The complete connected component receives one deterministic split, so transitive relationships cannot leak across dataset boundaries. No personal identifiers are stored; committed examples use synthetic grouping references only.

## Safety boundary

- offline synthetic fixtures only;
- no production videos, credentials, personal data, or production metadata;
- no model or pose inference;
- no user-visible results;
- no database, Storage, deployment, or Batch 5 cohort changes;
- no medical, veterinary, performance, or injury claims.

## Acceptance

```bash
node scripts/verify-batch8-video-segmentation.mjs intelligence/batch8-video-segmentation.example.json
node --test scripts/test-batch8-video-segmentation.mjs
```

Frontend CI runs Batch 8 together with the accepted Batch 5–7 gates.
