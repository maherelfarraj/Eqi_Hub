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

Display a 0–100 **RiderSync Score** with its components visible before the
overall value is calculated:

- safety and horse welfare: 25%;
- rhythm and control: 20%;
- balance and position: 20%;
- horse–rider partnership: 20%;
- training consistency: 10%;
- reflection and coach feedback: 5%.

Discipline-specific measures such as jumping technique may inform the relevant
components, but fence height and speed must never directly increase the score.

Scores must:

- compare the rider primarily with their own accepted baseline;
- account for riding level, discipline, horse, and lesson objective;
- expose the coach-approved evidence behind every material change;
- use repeated evidence so one difficult lesson cannot create a punitive drop;
- never be used as a medical, employment, or safeguarding decision;
- remain private by default with no public rider leaderboard.

### Badge design

Use the **EquiVista Rider Journey** as the progression identity. Its ten
unlockable titles are Arena Explorer, Rhythm Rider, Balanced Rider, Precision
Rider, Confident Canter, Course Navigator, Harmony Rider, Performance Rider,
EquiVista Champion, and Equestrian Elite. A rider may display any previously
unlocked title.

Support three clearly labelled badge sources: AI-observed, coach-approved, and
journey. Evidence-backed examples include Horse First, Quiet Hands, Balanced
Seat, Rhythm Keeper, Straight & True, Grid Graduate, Course Clever, Reflection
Rider, Training Streak, Comeback Rider, Perfect Partner, and Coach's Choice.
Use circular enamel-style medallions with ivory, bronze, silver, gold, and deep
burgundy progression, a simple horse/rider symbol, and the EquiVista seal.
Badge detail includes the date, horse, evidence, award reason, and approval
status.

Badges may use staged Bronze, Silver, and Gold thresholds. AI may propose a
badge, but the coach approves it and supplies a short message. Formal academy
certificates require administrator approval and verifiable supporting lessons.
Badges and titles are motivational records, not professional qualifications or
competition certification.

### Healthy motivation controls

- reward personal improvement, persistence, safe practice, and consistency;
- do not reward excessive training volume, repeated uploads, unsafe intensity,
  or comparison with differently situated riders;
- allow academies to reduce or disable gamification by rider preference or age;
- use age-appropriate English and Arabic wording;
- allow notification preferences for badges, goals, homework, coach replies,
  and weekly summaries;
- provide a respectful review path when a rider questions an assessment.

## Phase 5C — On-demand smart training assignments

Offer an optional paid assignment for a free-riding or training day. A rider
chooses the horse, available time, arena dimensions, available equipment, and
goal. The planner uses coach-approved history, current competencies, recent
workload, horse restrictions, and equipment to produce:

- warm-up, controlled flatwork, polework, horse gymnastics, or a small jumping
  course;
- exercise order, repetitions, rest periods, maximum session duration, and
  cool-down;
- rider focus points, common mistakes, welfare checks, and stop conditions;
- a visual arena/course layout, equipment list, downloadable session card,
  optional voice guidance, and safe alternative exercises;
- post-session reflection, optional video upload, analysis, and coach review.

The LLM proposes only inside a deterministic, versioned safety envelope. The
exercise library, not free-form generation, defines permitted movements,
distances, combinations, prerequisites, and contraindications. Flatwork may be
released immediately only when all configured checks pass. Jumping requires an
existing coach-approved envelope or explicit coach approval and any configured
supervision.

## Phase 5D — Academy, personal, and guest horses

Allow the rider to select an academy horse, a previously approved personal
horse, or a guest horse for one session. Horse onboarding records age, breed,
height, experience, fitness, training level, temperament, known risks,
restrictions, maximum approved fence height, workload, recovery, vaccinations,
insurance, facility documents, and owner/veterinary emergency contacts.

Before assignment release, check rider–horse compatibility, recent workload,
soundness declaration, arena surface, weather where relevant, equipment, and
required supervision. A new rider–horse combination or guest horse requires
facility approval. Until cleared, limit the plan to the academy's safe
familiarisation, groundwork, or controlled-flatwork policy; do not generate a
jumping assignment.

## Phase 5E — Coach safety and approval controls

Give the assigned coach an auditable safety envelope for each rider–horse pair:

- permitted exercise families and prohibited activities;
- maximum fence height, complexity, repetitions, duration, and workload;
- supervision, facility, surface, equipment, and recovery requirements;
- current rider and horse restrictions;
- validity period and review date.

The coach can approve, edit, replace, or reject an AI assignment, approve
achievement evidence, award Coach's Choice, and set the next development
focus. Facility staff retain authority to stop a session regardless of a prior
approval. AI output cannot override a coach, facility, veterinary restriction,
or stop condition.

## Phase 5F — Guardian View Portal

For a rider below the jurisdiction-configured adult age, require at least one
verified parent or legal guardian and provide a view-only portal showing:

- attendance, RiderSync components, titles, badges, achievements, goals, and
  coach-approved summaries;
- upcoming lessons, approved assignments, assigned horses, training-load
  status, invoices, purchases, and safety or incident notifications;
- weekly progress summaries with positively worded focus areas.

Guardians may approve only configured actions such as purchases, personal- or
guest-horse registration, video/AI consent, and supervised jumping. They cannot
alter assessments, scores, lesson records, achievement evidence, or private
staff notes. Support multiple verified guardians per rider and multiple minors
per guardian, audit every approval and access change, and automatically review
guardian access when the rider reaches adulthood. An adult rider may separately
invite and revoke an optional Supporter View.

## Phase 5G — Digital medical, waiver, and consent gate

Block activation when required safety documents are incomplete:

1. At registration and every membership renewal, collect the current full
   medical/safety form, liability waiver, emergency-treatment consent, and
   relevant photo, video, and AI-processing choices.
2. Require a new full signature when the document version or declared medical
   information changes.
3. Before every lesson or independent assignment, collect a short health and
   readiness declaration linked to the current full documents.
4. An adult rider signs personally. For a minor, a verified parent or legal
   guardian provides the legally required signature and approvals; a minor's
   acknowledgement does not replace it.

Preserve the exact signed content, document version, rider and signer IDs,
relationship, lesson or membership reference, signature evidence, timestamps,
expiry, supersession, and a downloadable PDF receipt. Signed records are
immutable; corrections create a new version. Expose only `Cleared`,
`Restricted`, `Review Required`, or `Pending Consent` plus the minimum necessary
safety instructions to coaches. Apply field-level access, retention, deletion,
breach-response, and jurisdiction-specific legal review to medical and minor
data.

## Phase 5H — Commerce and optional add-ons

Model purchasable products for a single assignment, multi-session pack,
monthly training assistant, AI video analysis, coach-reviewed assignment,
personal-horse assessment, facility/equipment booking, and supervised jumping.
Show price, inclusions, expiry, cancellation/refund terms, required approvals,
and processing-cost limits before purchase. Purchases by minors require the
configured guardian approval. Payment enablement remains subject to the
separate commercial, legal, PCI, refund, dispute, and reconciliation gates in
the canonical roadmap.

### Phase 5 rollout order

1. Rider ledger, competency pathway, and coach approval.
2. Dashboard, RiderSync components, Rider Journey titles, and badges.
3. Guardian relationships, view boundaries, and approval permissions.
4. Versioned medical/safety forms, waivers, signatures, and activation gates.
5. Academy, personal, and guest-horse profiles plus facility approval.
6. Deterministic flatwork and polework assignment library.
7. Course builder, gymnastics, and coach-controlled jumping assignments.
8. Commercial entitlements and optional add-ons after Phase 2 acceptance.
9. Video analysis, adaptive plans, and coach correction feedback.
10. Four-persona browser acceptance plus separate minor/guardian, horse,
    safety, payment, and rollback gates before cohort expansion.

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
- assignment templates and versions, generated plans, safety-envelope checks,
  course layouts, equipment, completion evidence, and coach decisions;
- horse ownership/use relationships, horse documents, rider–horse approvals,
  workload, restrictions, and expiry states;
- guardian relationships, scoped permissions, approvals, and access history;
- consent-document versions, immutable signatures, health declarations,
  clearance status, expiry, and receipt references;
- add-on catalogue, orders, guardian approvals, refunds, and entitlement state.

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
- permission tests for minor, guardian, coach, academy, and adult-supporter
  boundaries;
- waiver/version/expiry tests that fail closed before renewal, lesson, or
  assignment activation;
- deterministic assignment-safety tests for level, horse, workload,
  supervision, equipment, and jumping constraints;
- commerce tests for entitlements, guardian approval, cancellation, and
  payment-provider failure without double fulfilment;
- representative coach acceptance across horses, riders, fences, arenas, and
  devices.

## Stage 6 boundary

Phase 1 Stage 6 may perform capture-quality research, dataset governance,
offline experiments, and production shadow measurements for the existing
controlled cohort. It must not replace accepted user-visible analysis, widen
the cohort, provide veterinary diagnosis, or incur uncontrolled training or
inference cost without a separately approved implementation and budget.
