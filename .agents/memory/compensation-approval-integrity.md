---
name: Compensation approval integrity
description: Rules for preserving the audit meaning of academy payroll and commission approval.
---

Approved academy payroll and commission calculations must be immutable. Approval must happen only through a dedicated administrator-only transition from the submitted state, never as part of a general upsert.

**Why:** A general update can otherwise alter, reopen, or race an approval, undermining both the approval boundary and its audit trail.

**How to apply:** Preserve this boundary whenever compensation records or approval flows change.