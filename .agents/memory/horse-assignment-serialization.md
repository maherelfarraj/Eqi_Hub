---
name: Horse operational safety boundaries
description: Concurrency and audit-privacy rules for safe operational horse eligibility.
---

Any operational action that changes a horse's assignment eligibility must serialize on the same transaction-scoped per-horse lock. Generic audit streams must remove staff-only operational notes before storing snapshots.

**Why:** Snapshot-only checks can admit conflicting assignments during concurrent eligibility changes. Generic audit readers can include broader organization roles than the staff-only operational audience.

**How to apply:** New eligibility-changing actions and assignment workflows must join the shared lock and central eligibility guard. When operational data enters a broader audit stream, redact fields outside that stream's audience.