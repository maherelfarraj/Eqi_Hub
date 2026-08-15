# Batch 2 — RiderSync dashboard foundation

Batch 2 turns the approved lesson-development ledger from Batch 1 into a private, evidence-backed rider journey. It adds a 0–100 RiderSync score, named journey titles, coach-approved achievement medallions, and bilingual dashboard surfaces.

## RiderSync formula

| Component                     | Weight | Evidence source                                             |
| ----------------------------- | -----: | ----------------------------------------------------------- |
| Safety and horse welfare      |    25% | Approved Safety competency progress                         |
| Rhythm and control            |    20% | Approved Flatwork and Polework progress                     |
| Balance and position          |    20% | Approved Position and Jumping progress                      |
| Horse-rider partnership       |    20% | Approved Partnership progress                               |
| Training consistency          |    10% | Approved lesson reports in the latest 90 days               |
| Reflection and coach feedback |     5% | Rider reflections on approved reports in the latest 90 days |

The database enforces the weighted formula. Each report approval or rider reflection creates an idempotent, append-only snapshot. Titles unlock from the score, but the score compares a rider only with their own approved record.

## Motivation model

- Ten bilingual journey titles run from **Arena Explorer** to **Equestrian Elite**.
- Twelve bilingual medallions include **Horse First**, **Quiet Hands**, **Balanced Seat**, **Reflection Rider**, and **Coach's Choice**.
- AI may propose a future badge signal, but only an assigned coach or authorized academy staff member can approve a visible award.
- There is no public leaderboard and no rider-to-rider rank.

## Security boundary

All five new public tables have RLS enabled and explicit Data API grants. Score snapshots and title unlocks use `private.can_read_rider`; approved badges use the same rider/guardian/coach scope, while badge creation additionally requires `private.can_manage_rider_development`. The dashboard RPC is `security invoker` and never reads `lesson_development_private_notes`.

RiderSync is a motivation and training-reflection tool. It must not be used as medical, safeguarding, employment, or selection evidence.

## Acceptance

- Static migration verifier: `node scripts/verify-ridersync-dashboard.mjs`
- Verifier tests: `node --test scripts/test-ridersync-dashboard.mjs`
- Disposable persona/RLS fixture: `tests/rls/batch_2_ridersync_dashboard.sql`
- Frontend state guards: included in the frontend `test:server` command

The disposable SQL fixture proves a coach approval creates score 21, a rider reflection raises the snapshot to 26, the correct titles unlock, a coach badge is visible to the linked rider and guardian, rider self-awards fail, unrelated reads return no rows, and private notes are absent from the dashboard payload.
