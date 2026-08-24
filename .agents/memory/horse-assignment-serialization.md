---
name: Horse assignment serialization
description: Concurrency and lifecycle rules for safe operational horse eligibility.
---

Horse availability approval, holds, and assignments must take the same transaction-scoped lock for a given organization and horse. Operational profile identity is immutable, and direct profile deletion must fail closed; canonical horse deletion retains its database-driven cascade cleanup.

**Why:** Snapshot-only eligibility checks can admit conflicting assignments or miss a concurrently-created hold. Removing a profile while an assignment validates also defeats the required explicit-profile, fail-closed model.

**How to apply:** Any future operational action that changes assignment eligibility, or any new assignment or booking workflow, must participate in the same lock and invoke the central eligibility guard. Preserve the canonical horse lifecycle rather than blocking its dependent-record cleanup.