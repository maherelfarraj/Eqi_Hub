# Batch 1 — Rider Development Foundation

## Outcome

Batch 1 turns a completed lesson into a structured, coach-approved development record. It establishes the evidence model required for later rider dashboards, scores, badges, level names, optional self-training plans, and parent visibility without awarding or selling those future features yet.

## User flow

1. The assigned coach, or authorized academy staff, opens a confirmed or completed lesson.
2. Staff records objectives, strengths, focus areas, rider–horse observations, independent practice, next focus, three 1–5 session scores, and competency evidence.
3. Staff can save a private draft. Draft reports and draft evidence remain staff-only.
4. Approval freezes the report and promotes its evidence into the rider's longitudinal competency progress.
5. The rider and linked guardian can read the approved report. The rider can add a reflection or question and choose whether that reflection is visible to the guardian.
6. Private coaching/safeguarding notes remain inaccessible to riders and guardians.

## Data model

- `rider_competency_catalog`: versioned system or organization competency definitions.
- `lesson_development_reports`: one immutable-after-approval closeout per lesson.
- `lesson_development_report_history`: staff-only snapshots of edited drafts.
- `lesson_development_private_notes`: staff-only notes kept outside the rider-facing payload.
- `lesson_development_reflections`: rider-owned reflection and coach question.
- `rider_competency_evidence`: lesson-level evidence, promoted only at approval.
- `rider_competency_progress`: longitudinal highest confirmed stage and evidence count.

The initial catalog covers safety, flatwork, position, polework, jumping, course riding, and horse partnership. Stages are `introduced`, `practising`, `demonstrated`, and `achieved`.

## Authorization boundary

- Active coach assignments must match organization, rider, effective dates, and coach role.
- Academy admins, stable managers, and platform admins can manage development records within their existing organization authority.
- Riders and linked guardians see approved content only through the canonical `private.can_read_rider` relationship.
- Only the rider can create or update their reflection.
- Approved reports cannot be edited. A future correction must use an explicit superseding-report workflow rather than rewriting evidence.
- Explicit table privileges are granted separately from RLS for Data API compatibility.

## Files and validation

- Forward migration: `supabase/migrations/20260814202204_rider_development_foundation.sql`
- Rollback: `supabase/rollback/20260814202204_rider_development_foundation_rollback.sql`
- Disposable persona acceptance fixture: `tests/rls/batch_1_rider_development.sql`
- Static migration verifier: `scripts/verify-rider-development-foundation.mjs`
- Frontend closeout and reflection tests: `artifacts/equus-voyages/src/pages/lesson-development-state.test.mjs`

Before deployment, replay the forward migration and the RLS acceptance fixture on a disposable Supabase preview branch. Production deployment, seed changes, scoring rules, badges, payments, waiver signatures, and parent-portal expansion are outside Batch 1.
