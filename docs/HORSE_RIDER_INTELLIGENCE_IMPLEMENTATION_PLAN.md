# Horse–Rider Intelligence Implementation Plan

Date: 2026-08-14 (Asia/Amman)

## Product objective

Build an evidence-based coaching system that evaluates the rider, the horse,
and their interaction during flatwork and jumping. The system should identify
technique and movement issues, link every finding to observable video evidence,
and suggest coach-reviewable corrections.

The product is a performance-support tool. It must not diagnose injury,
lameness, pain, or veterinary conditions. Possible movement irregularities are
flagged for qualified coach or veterinary review.

## Delivery principles

1. Preserve the accepted React, Supabase, private Storage, and Railway worker
   architecture. Streamlit and SQLite may be used only in an isolated research
   workbench.
2. Introduce the new models in shadow mode before any result reaches a pilot
   user.
3. Prefer an unavailable or review-required result over a confident-looking
   result from poor footage or uncertain keypoints.
4. Keep raw footage private, minimize derived personal data, and retain consent,
   model lineage, evidence, and deletion controls.
5. Measure quality by coaching outcomes and event accuracy, not one aggregate
   model score.
6. Pin model, library, and dataset versions. Complete a commercial licence
   review before adopting any restricted training or inference dependency.

## Scope

### Rider intelligence

- shoulder–hip–heel and ear–shoulder–hip alignment;
- hip, knee, ankle, elbow, and trunk angles;
- upper-body stability, hand stability, release timing, and recovery balance;
- left/right asymmetry and position during approach, takeoff, apex, landing,
  and departure.

### Horse intelligence

- stride rhythm, stride-length consistency, and left/right asymmetry;
- poll, neck, withers, back, and croup alignment;
- takeoff distance, limb folding, fence clearance, landing pattern, drift,
  impulsion, and recovery rhythm;
- repeated movement irregularities that require human review.

### Horse–rider interaction intelligence

- rider ahead of or behind the horse's motion;
- release timing relative to takeoff;
- rider asymmetry correlated with horse drift or stride shortening;
- balance changes correlated with impulsion or rhythm loss;
- recovery time for the pair after landing.

## Phase 0 — Feasibility, safety, and acceptance design

### Deliverables

- supported discipline and jump-type matrix;
- capture specification with minimum and recommended FPS, shutter, angle,
  distance, lighting, visibility, and camera-motion limits;
- consent, minor/guardian, retention, deletion, and dataset-use rules;
- coaching-language and veterinary-safety policy;
- dependency and model-licensing decision;
- metric definitions and an untouched golden-video acceptance set.

### Exit criteria

- a qualified equestrian reviewer approves the coaching taxonomy;
- unsuitable footage is rejected before paid or expensive processing;
- every output category has a confidence threshold and review-required path;
- no output claims medical diagnosis or injury prediction.

## Phase 1 — Capture quality and data engineering

### Capture assistant

Before upload, assess whether:

- the full horse and rider remain visible;
- the view is sufficiently side-on for the requested metrics;
- lighting, resolution, blur, and frame rate are adequate;
- the camera is stable and the jump plane is visible;
- a calibration object or marked rail can be resolved when real-world distance
  is requested.

Accept common 30/60 FPS videos for general coaching with reduced confidence;
recommend 60 FPS or above for jump-event timing. Higher frame rates are useful
only when exposure and image quality remain adequate.

### Data segmentation

- preserve source timestamps and variable-frame-rate metadata;
- identify candidate jump windows before dense extraction;
- retain at least three strides before and two strides after each fence;
- standardize model tensors without discarding the original aspect ratio,
  timestamps, or source-resolution metadata.

### Dataset separation

Split train, validation, and test sets by source video, horse, rider, arena,
camera, and recording session. Adjacent frames from one clip must never cross
dataset boundaries.

## Phase 2 — Annotation and skeletal definitions

### Horse keypoints

Use a versioned skeleton with, at minimum:

1. poll;
2. withers;
3. croup;
4. near shoulder;
5. near elbow;
6. near knee;
7. near front fetlock;
8. near front hoof;
9. far shoulder;
10. far elbow;
11. far knee;
12. far front fetlock;
13. far front hoof;
14. near hip/stifle origin;
15. near stifle;
16. near hock;
17. near rear fetlock;
18. near rear hoof;
19. far hip/stifle origin;
20. far stifle;
21. far hock;
22. far rear fetlock;
23. far rear hoof.

Each keypoint records normalized coordinates plus visible, occluded,
outside-frame, or not-applicable state. Near/far limb conventions must be
defined from the camera view and applied consistently.

### Annotation quality

- tight whole-horse bounding box plus ordered keypoints;
- double-review a statistically useful sample;
- measure inter-annotator pixel and normalized-coordinate disagreement;
- adjudicate ambiguous limb crossings;
- version the annotation guide, skeleton, dataset, and exports together.

Begin with a feasibility set, then use active learning to select uncertain,
diverse frames rather than labeling many adjacent frames.

## Phase 3 — Dual pose and tracking models

### Rider model

Use a pinned human pose implementation in video mode. Retain shoulders, elbows,
wrists, hips, knees, ankles, heels, and foot-index points with confidence and
visibility. Associate the rider pose with the horse instance through temporal
tracking and spatial constraints.

### Horse model

- compare transfer learning against a scratch or animal-pretrained baseline;
- train small and medium candidates rather than assuming one nano model is
  sufficient;
- tune augmentation for blur, lighting, horse colour, tack, fence occlusion,
  and near/far limb crossings;
- export a reproducible inference artifact with model, dataset, skeleton,
  dependency, and training-configuration versions.

### Model acceptance

Do not use a single `mAP >= 0.85` rule. Require:

- pose mAP50–95 and per-keypoint PCK;
- visibility/occlusion accuracy;
- temporal jitter and track-loss rate;
- performance by horse colour, arena, device, lighting, and occlusion;
- no horse, rider, video, or adjacent-frame leakage into the golden set.

## Phase 4 — Signal conditioning, calibration, and jump events

### Signal conditioning

- reject low-confidence observations before smoothing;
- interpolate only bounded short gaps;
- use an offline centred filter for completed videos;
- use a causal confidence-aware filter for live overlays;
- never smooth across long occlusions, cuts, or track-identity changes.

### Coordinate convention

Image `y` increases downward. The withers/croup midpoint is a torso-centroid
proxy, not the anatomical centre of mass. Derivatives use source timestamps,
not an assumed constant frame interval.

### Jump phases

Detect approach, takeoff, flight, apex, landing, and departure from a fusion of:

- torso-centroid vertical velocity and acceleration;
- front and rear hoof contact states;
- fence-plane position;
- limb configuration;
- temporal consistency constraints.

Fixed thresholds provide the initial explainable baseline. After enough
reviewed sessions, compare them with a temporal phase classifier. Measure event
accuracy as frame/time error against coach-reviewed events.

### Spatial calibration

- correct lens distortion when calibration data is available;
- estimate the ground/jump plane with multiple reference points;
- use a homography rather than a global pixel-to-metre constant when
  perspective is material;
- report calibration confidence and refuse physical-distance claims when the
  camera moves or reprojection error is excessive.

## Phase 5 — Coaching metrics and issue detection

### Rider metrics

- trunk inclination and stability;
- shoulder–hip–heel alignment error;
- hip, knee, ankle, and elbow angles;
- hand/release timing;
- left/right symmetry;
- landing recovery time.

### Horse metrics

- stride rhythm and consistency;
- takeoff distance and symmetry;
- limb-folding and clearance proxies;
- landing pattern, drift, and departure rhythm;
- repeated left/right movement irregularity.

### Interaction metrics

- phase difference between rider motion and horse torso motion;
- release timing relative to takeoff;
- correlations between rider imbalance and horse drift, rhythm, or stride
  changes;
- pair recovery time after landing.

Each finding contains an issue code, severity, confidence, phase, frame/time
range, visual evidence, plain-language explanation, suggested exercise, and
human-review status. Low-confidence findings are withheld or marked for review.

## Phase 6 — Product and production integration

Extend the existing Railway worker rather than creating a second production
application. Keep the current production LLM pipeline available as a rollback
and comparison path while replacing the deterministic pose stub.

### Data model

Store compact summaries and lineage in Postgres:

- analysis run and parent video-analysis reference;
- model, skeleton, dataset, calibration, and code versions;
- processing status, duration, token/resource use, and cost;
- phase events, metric summaries, findings, confidence, and review state;
- reviewer corrections and acceptance timestamps.

Store dense frame keypoints and overlay artifacts in private object storage,
not as unbounded relational rows. Apply existing organization, rider, guardian,
coach, administrator, and Storage access rules to every new artifact.

### Reliability and observability

- idempotent job claims and completion;
- bounded retries and stable failure codes;
- health, latency, cost, queue, model-quality, and rejection metrics;
- model and feature kill switches;
- immutable lineage for every displayed finding;
- rollback to the last accepted pipeline without deleting evidence.

## Phase 7 — Shadow validation and controlled release

1. Run capture-quality checks without changing user-visible results.
2. Run rider pose in shadow mode and compare with coach labels.
3. Run horse pose and jump phases in shadow mode.
4. Add coach correction tools and feed reviewed corrections into the dataset.
5. Release frame-linked rider findings to the controlled cohort.
6. Release horse movement and interaction findings only after separate
   acceptance and safety review.
7. Expand beyond the controlled cohort only through a later explicit gate.

## Required test layers

- unit tests for angles, derivatives, filters, calibration, and phase logic;
- golden-frame keypoint tests;
- golden-video event and metric tests;
- property tests for missing points, zero-length vectors, and timestamp gaps;
- tenancy/RLS and private-storage tests;
- idempotency, retry, timeout, and rollback tests;
- browser tests for overlays, confidence, review, and bilingual copy;
- representative coach acceptance across horses, riders, fences, arenas, and
  devices.

## Stage 6 boundary

Phase 1 Stage 6 may perform capture-quality research, dataset governance,
offline experiments, and production shadow measurements for the existing
controlled cohort. It must not replace accepted user-visible analysis, widen
the cohort, provide veterinary diagnosis, or incur uncontrolled training or
inference cost without a separately approved implementation and budget.
