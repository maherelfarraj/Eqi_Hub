# Batch 3 — Guardian View and approval boundaries

Batch 3 turns the legacy `guardian_riders` link into a verified, auditable
relationship. A verified guardian receives a view-only portal for a linked
rider and may respond only to the approval types explicitly enabled on that
relationship.

## Relationship lifecycle

- `pending` — link exists but grants no rider-data access.
- `verified` — active access is allowed until its expiry or adulthood review.
- `review_required` — access is paused until authorized staff reviews it.
- `revoked` — access is closed and the revocation remains auditable.

Existing active guardian links migrate to `verified` so production access does
not regress. Multiple guardian links per rider and multiple rider links per
guardian continue to use the existing composite relationship key. A
`supporter` relationship is view-only and can never carry legal approval
permissions.

## View boundary

The guardian portal returns only the selected linked rider's:

- RiderSync score, titles, approved badges, evidence summary, and approved
  coach focus;
- recent lessons and attendance totals;
- assigned horses;
- invoices only when `can_view_financials` is enabled;
- guardian approval requests and the relationship's audit history.

It never reads lesson-development private notes, raw medical data, payment
credentials, or unrelated riders. Expired and adulthood-review-due links are
denied by `private.can_guardian_access_rider` and therefore by the shared
`private.can_read_rider` boundary.

## Approval boundary

The relationship has separate permissions for purchases, horse registration,
video/AI consent, and supervised jumping. A guardian can approve or decline a
pending request only when:

1. the relationship is active and verified;
2. legal authority is recorded;
3. the exact approval permission is enabled;
4. the request is not expired; and
5. immutable request details have not changed.

Medical forms, signatures, payment capture, and the underlying commerce or
horse-registration workflows are intentionally not implemented here. They
remain gated follow-on batches.

## Acceptance

- Static verifier: `node scripts/verify-guardian-view.mjs`
- Verifier tests: `node --test scripts/test-guardian-view.mjs`
- Disposable persona/RLS fixture: `tests/rls/batch_3_guardian_view.sql`
- Frontend state guards: included in the frontend `test:server` command

The fixture proves verified guardian access, per-permission approval,
multi-minor isolation, unrelated-user denial, supporter write denial, adulthood
review denial, immutable audit events, and absence of private coach notes.
