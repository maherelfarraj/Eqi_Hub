---
name: Private video review approval boundary
description: Rules for keeping private review output consented, tenant-scoped, and coach-approved.
---

Private video review content is only audience-visible after recorded consent and assigned-coach approval. Any clip change or audience-visible annotation change invalidates the session approval and requires a new coach approval before a rider or verified guardian can read it.

**Why:** Approval applies to a specific reviewed content set. Allowing later derivatives or annotations to inherit an earlier approval would expose unreviewed coaching output.

**How to apply:** Keep audience access fail-closed on the session approval state. Any future processor, annotation tool, export, or sharing feature must either invalidate the existing approval or introduce an equally strict per-item approval record; it must not preserve audience visibility by default.