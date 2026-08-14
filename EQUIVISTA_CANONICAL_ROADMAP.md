# EquiVista Canonical Product and Go-Live Roadmap

**Baseline date:** 2026-08-13

**Canonical repository:** `maherelfarraj/Eqi_Hub`

**Purpose:** Consolidate the product, enterprise, security, infrastructure, and launch work into one roadmap.

## Status definitions

- **Complete:** Implemented, merged, and materially verified.
- **Partial:** Usable implementation exists, but an integration, acceptance test, or production gate remains.
- **Foundation only:** Database model or technical scaffold exists; complete user workflows and acceptance are still required.
- **Planned:** No verified production implementation is recorded.

## Executive progress snapshot

| Measurement                                    | Estimated progress | Current position                                                                               |
| ---------------------------------------------- | -----------------: | ---------------------------------------------------------------------------------------------- |
| Production hardening and operational readiness |                96% | Critical technical launch gates are closed; commercial and legal launch gates remain.          |
| Core academy MVP                               |                84% | Pilot personas are provisioned and preflight READY; linked-persona browser acceptance is next. |
| Full enterprise product roadmap                |                44% | Launch foundations are stronger; enterprise workflows still require product implementation.    |

The percentages are planning estimates, not a count of migrations or pull requests. A database foundation does not count as a completed product feature.

## Track A — Core academy MVP

| Capability                                                                | Status   | Remaining acceptance                                                                           |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| Application shell, navigation, responsive UI, and localization foundation | Complete | Continue accessibility and browser regression coverage.                                        |
| Authentication, password recovery, session handling, and protected routes | Complete | Keep production redirect and email-delivery monitoring active.                                 |
| Organization bootstrap, membership, tenancy, and multi-role access        | Complete | Maintain persona/RLS regression testing as roles expand.                                       |
| Rider profiles, rider detail, and rider administration                    | Complete | Product-level regression and usability acceptance.                                             |
| Horse records and basic horse operations                                  | Partial  | Complete richer horse lifecycle and welfare workflows.                                         |
| Lesson screens and scheduling foundation                                  | Partial  | Complete booking rules, availability, attendance, cancellation, and notification journeys.     |
| Parent/member portal experiences                                          | Partial  | Complete production persona acceptance and notification journeys.                              |
| Membership and billing foundation                                         | Partial  | Complete commercial pricing, subscription lifecycle, refunds, and payment-provider acceptance. |
| Dashboard, progress, reporting, and settings screens                      | Partial  | Complete reporting coverage, filters, exports, and role-specific acceptance.                   |
| Audit log and organization administration                                 | Complete | Expand audit coverage as enterprise modules are activated.                                     |

## Track B — AI riding-video platform

| Capability                                                             | Status          | Remaining acceptance                                                   |
| ---------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------- |
| Secure riding-video upload and storage model                           | Complete        | Continue storage, tenancy, and upload monitoring.                      |
| Asynchronous worker and processing orchestration                       | Complete        | Continue runtime and queue monitoring.                                 |
| Frame extraction, riding-content validation, and LLM analysis pipeline | Complete        | Continue representative quality, timing, and cost monitoring.          |
| Analysis results, feedback, and progress display                       | Partial         | Expand acceptance across representative videos, personas, and devices. |
| Worker CI, health checks, Railway deployment, and Wait for CI          | Complete        | Record the first normal post-enable deployment observation.            |
| Combined rider, horse, and interaction intelligence                    | Planned         | Execute the versioned pose, kinematics, calibration, safety, shadow-validation, and coach-review plan. |
| Advanced coaching insights and longitudinal recommendations            | Planned         | Convert accepted frame-linked findings into safe corrections, exercises, trends, and human-reviewed recommendations. |
| AI operations console, evaluation, cost, and model-quality monitoring  | Foundation only | Build operator UI, alerts, evaluation datasets, and budgets.           |

## Track C — Academy operations

| Capability                      | Status          | Required product work                                                                    |
| ------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Horse operations                | Partial         | Lifecycle, assignment, availability, ownership, and operational UX.                      |
| Horse welfare                   | Foundation only | Health records, vaccinations, farrier, medication, incidents, reminders, and reports.    |
| Rider pathway                   | Foundation only | Deliver coach-validated lesson reports, structured competencies, evidence-backed progress, goals, rider reflections, achievement approval, and level advancement. |
| Lesson scheduling               | Partial         | Resource availability, recurring schedules, conflicts, cancellations, and notifications. |
| Lesson booking and attendance   | Foundation only | Self-service booking, waitlists, check-in, absence handling, then coach-approved lesson closeout and training output. |
| Academy lifecycle management    | Foundation only | Onboarding, suspension, renewal, offboarding, and retention workflows.                   |
| Staff attendance and timesheets | Foundation only | Clocking, approval, exceptions, leave, and operational reports.                          |
| Coach payroll automation        | Foundation only | Rate rules, approvals, adjustments, payroll exports, and audit controls.                 |
| Action centre workflow          | Foundation only | Unified tasks, ownership, priorities, due dates, escalation, and notifications.          |

## Track D — Billing, payments, and customer finance

| Capability                            | Status          | Required product/commercial work                                                                 |
| ------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| Membership billing                    | Foundation only | Plans, cycles, proration, discounts, renewals, suspensions, and customer UX.                     |
| Invoicing and receivables             | Foundation only | Invoice creation, delivery, credit notes, receipts, statements, and aging.                       |
| Online payment reconciliation         | Foundation only | PCI-compliant provider integration, callbacks, failure handling, refunds, and reconciliation UI. |
| Cash and expense reconciliation       | Foundation only | Cash controls, expense entry, approval, attachments, and reconciliation workflows.               |
| Payment reminders and collections     | Foundation only | Reminder policies, communication delivery, promises-to-pay, disputes, and collection queues.     |
| Merchant and acquiring-bank readiness | Partial         | Final provider selection, legal review, acquiring approval, terms, and production acceptance.    |

## Track E — Procurement, suppliers, and treasury

| Capability                             | Status          | Required product work                                                                  |
| -------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| Purchase orders and procurement        | Foundation only | Requisitions, approvals, vendor selection, POs, receipt, and budget controls.          |
| Supplier invoice ledger                | Foundation only | Invoice capture, validation, approvals, tax treatment, and document workflow.          |
| Three-way matching                     | Foundation only | PO/receipt/invoice exceptions, tolerances, approvals, and audit trail.                 |
| Supplier payment runs                  | Foundation only | Proposal, approval, bank output, execution, reconciliation, and segregation of duties. |
| Bank reconciliation                    | Foundation only | Bank feeds/imports, matching rules, exception handling, and close controls.            |
| Treasury cash forecast                 | Foundation only | Forecast inputs, scenarios, actuals, variances, and dashboards.                        |
| Treasury scenarios and funding actions | Foundation only | Scenario modelling, alerts, approvals, and action-plan tracking.                       |

## Track F — Accounting, planning, and management reporting

| Capability                           | Status          | Required product work                                                                |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------ |
| General ledger and trial balance     | Foundation only | Posting workflow, periods, journals, controls, drill-down, and exports.              |
| Monthly financial close              | Foundation only | Close calendar, tasks, reconciliations, approvals, locks, and evidence.              |
| Financial statements                 | Foundation only | Statements, comparative periods, notes, review, exports, and audit traceability.     |
| Fixed assets and depreciation        | Foundation only | Asset register UX, capitalization, depreciation runs, disposals, and reconciliation. |
| Annual budget and variance           | Foundation only | Budget entry, versions, approvals, actuals, forecasts, and variance explanations.    |
| Cost-centre profitability            | Foundation only | Allocations, contribution analysis, drill-down, and management dashboards.           |
| VAT and tax compliance               | Foundation only | Tax configuration, return preparation, validation, filing evidence, and controls.    |
| Financial consolidation and FX       | Foundation only | Entity mapping, eliminations, FX, approvals, statements, and audit workflow.         |
| Management reporting and board packs | Foundation only | Templates, commentary, approvals, scheduled production, and secure distribution.     |

## Track G — Governance, risk, compliance, and assurance

| Capability                     | Status          | Required product work                                                          |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------ |
| Platform audit centre          | Foundation only | Operator UI, filters, evidence, retention, alerts, and investigation workflow. |
| Audit controls and findings    | Foundation only | Control library, testing, findings, ownership, remediation, and evidence.      |
| Continuous controls monitoring | Foundation only | Automated tests, thresholds, alerts, triage, exceptions, and dashboards.       |
| Enterprise risk management     | Foundation only | Risk register, scoring, treatment, controls, indicators, and review cycles.    |
| Compliance obligations         | Foundation only | Obligation register, owners, evidence, breaches, attestations, and reporting.  |
| Timestamped AI findings        | Foundation only | Human review, traceability, evidence retention, and governed action workflow.  |

## Track H — Security, data, and platform engineering

| Capability                                                   | Status   | Remaining work                                                                                                      |
| ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Supabase migration canonical baseline and ledger repair      | Complete | Keep replay verification mandatory for future migrations.                                                           |
| RLS, tenancy boundaries, RBAC, and storage-policy correction | Complete | Extend persona tests whenever tables or roles change.                                                               |
| Reusable persona security suite                              | Complete | Integrate into every relevant migration review.                                                                     |
| Supabase preview/replay validation                           | Complete | Monitor cost and clean disposable previews.                                                                         |
| Worker CI                                                    | Complete | Maintain dependency and runtime updates.                                                                            |
| Frontend/root application CI                                 | Complete | Required `frontend-verify` runs install, type-check, server tests, and production builds.                           |
| Production browser security headers                          | Complete | CSP and approved anti-clickjacking, MIME, referrer, and permissions headers are live-verified.                      |
| Dependency and secret security automation                    | Complete | Dependabot and CodeQL are enabled and currently report zero open findings; repository security controls are active. |
| Backup, PITR, and restore readiness                          | Complete | Daily backups were confirmed and an isolated restore drill was completed.                                           |
| Observability and incident response                          | Partial  | Define SLOs, alert routing, runbooks, escalation, and incident exercises.                                           |
| Branch governance and repository hygiene                     | Complete | Required checks and protection are aligned; merged Stage 6B branches were removed.                                  |

## Track I — Production operations and communications

| Capability                                           | Status   | Remaining work                                                               |
| ---------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Railway API health check and deployment verification | Complete | Continue post-deployment monitoring.                                         |
| Railway worker health and Wait for CI                | Complete | Record first routine deployment evidence.                                    |
| Supabase Auth redirects                              | Complete | Revalidate whenever domains or environments change.                          |
| Custom SMTP and recovery-email delivery              | Complete | Continue delivery monitoring and suppression handling.                       |
| `admin@equivista.net` operational mailbox            | Planned  | Configure MX/mail provider and create/test mailbox before using it for Auth. |
| Operational monitoring and closeout reports          | Complete | Convert periodic audits into recurring operational checks.                   |

## Track J — Launch and commercial acceptance

| Gate                                                 | Status                | Exit criterion                                                                                        |
| ---------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| Controlled pilot readiness                           | Active                | Stage 5 acceptance passed; continue only the named four-persona cohort with support, monitoring, and rollback controls. |
| Riding/non-riding production E2E                     | Complete              | Riding analysis succeeded and non-riding content was rejected in production.                          |
| Frontend CI and browser security headers             | Complete              | Required frontend and worker checks pass; live approved headers were verified.                        |
| Payment-provider production acceptance               | Pending               | Live provider, compliant implementation, callbacks, refunds, reconciliation, and acceptance evidence. |
| Legal, privacy, terms, and acquiring-bank acceptance | Pending               | Approved documents and commercial authorization are recorded.                                         |
| Backup/restore drill                                 | Complete              | Scheduled backups were verified and an isolated restore drill completed without production mutation.  |
| Unrestricted commercial launch                       | Hold                  | All high-risk gates above are closed and final launch approval is recorded.                           |

## Delivery sequence

### Phase 0F — Close critical launch risks

1. **Complete:** frontend/root CI and required checks.
2. **Complete:** production browser security headers.
3. **Complete:** riding/non-riding production E2E pair.
4. **Complete:** backup configuration and isolated restore drill.
5. **Complete:** repository security automation and Stage 6B branch cleanup.
6. **Complete:** technical closeout; unrestricted launch remains held on commercial and legal gates.

### Phase 1 — Controlled academy pilot

1. **Complete:** repository foundation for rider, parent/member (`guardian`), coach, and administrator personas.
2. **Complete:** read-only production preflight and fail-closed evidence automation.
3. **Provisioning complete:** four distinct active personas, guardian–rider and coach–rider links, and horse-access assignment are present; the production preflight is READY. Linked guardian visibility and legacy horse visibility require correction before browser acceptance.
4. **Complete:** support, incident, monitoring, feedback, and rollback ownership was exercised during the named Stage 5 acceptance window.
5. **In progress:** Stage 5 established the passing baseline for errors, video-analysis processing time, cost, and persona feedback; continue measuring adoption and repeat performance during the bounded pilot operating interval.

### Phase 2 — Commercial billing and payments

1. Finalize product plans, billing rules, invoice and receivable workflows.
2. Select and integrate the PCI-compliant payment provider.
3. Complete legal, privacy, acquiring-bank, refund, dispute, and reconciliation acceptance.
4. Launch controlled paid subscriptions before unrestricted activation.

### Phase 3 — Academy operations expansion

1. Complete horse welfare and rider-pathway product workflows.
2. Complete scheduling, booking, attendance, waitlist, and notification workflows.
3. Complete academy lifecycle, staff attendance, coach payroll, and action centre.
4. Deliver the coach-validated rider ledger, RiderSync scorecard, EquiVista
   Rider Journey titles, evidence-backed badges, and personal-progress dashboard.
5. Deliver optional on-demand flatwork, polework, gymnastics, and controlled
   small-course assignments using a versioned exercise library and coach safety
   envelopes rather than unrestricted LLM instructions.
6. Support academy, personal, and guest horses with rider–horse compatibility,
   workload, document, restriction, facility-approval, and supervision gates.
7. Deliver the under-18 Guardian View Portal with read-only progress,
   configurable approvals, weekly summaries, multi-guardian relationships, and
   automatic access review at adulthood.
8. Fail closed on digital medical/safety forms, liability waivers, guardian
   signatures, lesson readiness declarations, document versioning, expiry, and
   immutable audit receipts.
9. Add optional assignment packs, AI analysis, coach review, horse assessment,
   facility/equipment booking, and supervised-session entitlements only after
   Phase 2 commercial and legal acceptance.

### Phase 4 — Finance and procurement suite

1. Deliver procurement, supplier ledger, matching, and payment runs.
2. Deliver bank reconciliation, treasury forecasts, scenarios, and funding actions.
3. Deliver general ledger, close, statements, assets, budgets, VAT, and consolidation.
4. Deliver profitability analysis, management reporting, and board packs.

### Phase 5 — Governance and enterprise intelligence

1. Deliver audit, controls monitoring, risk, and compliance workflows.
2. Deliver governed AI operations, evaluations, evidence, and findings management.
3. Add enterprise reporting, alerts, exports, retention controls, and assurance evidence.

## Roadmap governance rules

1. A migration or schema is **foundation only** until its end-user and operator workflows are implemented and accepted.
2. Every feature must define an owner, acceptance criteria, tests, security impact, observability, rollback, and documentation.
3. All database changes must use canonical migrations and pass replay plus persona/RLS verification.
4. All application and worker changes must pass required CI before deployment.
5. Production mutations, deployments, paid previews, merges, and branch deletion require explicit authorization.
6. Roadmap percentages must be recalculated from accepted capabilities, not commit, migration, or PR counts.
7. This file is the planning source of truth; phase reports provide supporting evidence but do not replace it.

## Immediate next milestone

Operate **Phase 1 Stage 6 — Controlled Pilot Observation and Exit Review**: keep the cohort limited to the accepted four personas, monitor production health and support events, record routine adoption and repeat AI-processing time/cost evidence, and make a fresh continue/hold decision at the exit checkpoint. In parallel, begin only the bounded feasibility, dataset-governance, offline, and shadow-mode work in `docs/HORSE_RIDER_INTELLIGENCE_IMPLEMENTATION_PLAN.md`; do not replace accepted user-visible analysis without a separate gate. Do not enable live payments, widen registration, or authorize unrestricted commercial launch.
