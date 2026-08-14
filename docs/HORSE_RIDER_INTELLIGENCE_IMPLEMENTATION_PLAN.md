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

## Phase 5A — Coach-validated rider development ledger

Every completed lesson or class produces a structured development record. The
existing lesson-report and rider-pathway foundations should be extended rather
than replaced.

### Lesson lifecycle

1. Before the lesson, the coach reviews the rider's current level, previous
   report, open goals, homework, recent approved findings, and competencies
   awaiting confirmation.
2. The coach selects the lesson objectives and planned skills.
3. Confirmed attendance opens a draft lesson report.
4. AI may propose strengths, focus areas, interaction findings, evidence
   frames, competencies, and exercises.
5. The assigned coach accepts, edits, or rejects every proposed finding; adds
   professional observations; records effort and training output; and sets
   homework and the next focus.
6. The approved report becomes visible to the rider and linked guardian.
7. The rider may acknowledge the report, add a reflection, or ask a question
   without altering the coach assessment.

Unreviewed output remains **Draft — awaiting coach review** and must not affect
official progress, scores, badges, achievements, or level advancement.

### Structured lesson record

Record:

- lesson objectives and skills practised;
- attendance, effort, rider confidence, and lesson difficulty;
- coach-approved strengths and current focus areas;
- horse observations and horse–rider interaction findings;
- linked video-analysis findings and evidence frames;
- training output, homework, due date, and completion state;
- next-lesson focus and open questions;
- coach approval, rider acknowledgement, revisions, and timestamps.

Private coach notes must be stored separately from rider-visible and
guardian-visible feedback.

### Competency pathway

Use an academy-controlled, versioned skill catalogue covering safety,
mounting, walk/trot/canter control, transitions, balance, independent seat,
aids, pole work, jumping position, approach rhythm, takeoff, release, landing,
recovery, and course riding.

Each competency progresses through:

`not_started -> introduced -> practising -> demonstrated -> achieved`

A separate review flag identifies uncertain or disputed evidence. Achievement
requires repeated coach-approved evidence across the academy's configured
number of lessons; a single successful frame cannot complete a competency.

### Approval responsibilities

- AI proposes only; it never approves progress or achievement.
- Assigned coaches approve lesson reports and normal competency progress.
- Academy administrators approve formal level advancement, certificates, and
  awards configured as academy-level milestones.
- Riders acknowledge and reflect but cannot rewrite an assessment.
- Linked guardians receive read-only access plus permitted summaries.
- Every approval, rejection, correction, and supersession remains auditable.

## Phase 5B — Rider motivation, dashboard, scores, and badges

### Rider dashboard

Show:

- current riding level and progress toward the next level;
- multidimensional development scorecard and personal trend;
- latest coach-approved achievements and badges;
- skills being introduced, practised, demonstrated, and achieved;
- coach-approved strengths and positively worded **Focus Areas**;
- homework, next objective, rider reflections, and coach replies;
- lesson-by-lesson timeline with supporting evidence;
- horse-specific progress without unfairly combining unlike horses;
- weekly or monthly digest for the rider and linked guardian.

### Score design

Display safety, balance, control, position, rhythm/timing, jumping technique,
consistency, and coach-assessed effort separately before calculating any
overall 0–100 development score.

Scores must:

- compare the rider primarily with their own accepted baseline;
- account for riding level, discipline, horse, and lesson objective;
- expose the coach-approved evidence behind every material change;
- use repeated evidence so one difficult lesson cannot create a punitive drop;
- never be used as a medical, employment, or safeguarding decision;
- remain private by default with no public rider leaderboard.

### Badge design

Support evidence-backed skill, development, safety, consistency, and
horse–rider partnership badges. Examples include Balanced Seat, Smooth
Transitions, Steady Hands, Controlled Canter, Correct Release, Balanced
Landing, Homework Champion, Safety First, Strong Partnership, and Calm
Recovery.

Badges may use staged Bronze, Silver, and Gold thresholds. AI may propose a
badge, but the coach approves it and supplies a short message. Formal academy
certificates require administrator approval and verifiable supporting lessons.

### Healthy motivation controls

- reward personal improvement, persistence, safe practice, and consistency;
- do not reward excessive training volume, repeated uploads, unsafe intensity,
  or comparison with differently situated riders;
- allow academies to reduce or disable gamification by rider preference or age;
- use age-appropriate English and Arabic wording;
- allow notification preferences for badges, goals, homework, coach replies,
  and weekly summaries;
- provide a respectful review path when a rider questions an assessment.

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
- lesson development reports, competency evidence, pathway changes, scores,
  achievements, badges, reflections, approvals, and superseded versions.

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
