# Batch 9 — Offline Horse-Keypoint Annotation Quality Gate

Date: 2026-08-16 (Asia/Amman)

## Goal

Batch 9 begins Phase 2 of the Horse–Rider Intelligence plan with a deterministic,
offline contract for horse-pose annotations. It accepts only complete, versioned,
double-reviewed annotations that retain Batch 8 source and window lineage.

## Annotation contract

- exactly 23 ordered horse keypoints using the committed skeleton;
- normalized `x` and `y` coordinates for visible or occluded points;
- explicit `visible`, `occluded`, `outside-frame`, or `not-applicable` state;
- near/far limbs defined from the camera view;
- tight whole-horse boxes and immutable Batch 8 lineage references;
- two independent synthetic reviewer references per sampled frame.

## Quality decision

- `accepted`: state agreement and normalized coordinate disagreement pass;
- `review-required`: the annotation is structurally valid but agreement exceeds a
  configured threshold or limb-state ambiguity remains;
- `rejected`: malformed, incomplete, sensitive, untraceable, or single-reviewed
  evidence fails closed.

## Safety boundary

- offline synthetic fixtures only;
- no production footage, credentials, identifiers, or medical data;
- no model training or inference and no user-visible results;
- no medical, veterinary, performance, or injury claims;
- no database, Storage, deployment, or Batch 5 cohort changes.

## Acceptance

```bash
pnpm verify:batch9
pnpm test:batch9
pnpm typecheck
pnpm build
```
