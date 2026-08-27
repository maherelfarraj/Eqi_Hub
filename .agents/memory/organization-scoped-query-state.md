---
name: Organization-scoped query state
description: Prevents transient cross-organization data exposure without breaking current-organization error handling.
---

Organization-scoped asynchronous UI results must identify the organization that produced them, including disabled and error results. Never render data or errors whose organization does not match the currently selected organization.

**Why:** Resetting shared query state in an effect leaves one render where the previous organization can still be selected. Suppressing every untagged result prevents that leak, but also turns current request failures into an endless loading state unless errors are tagged too.

**How to apply:** On organization switches, synchronously suppress mismatched data and errors and show loading. Return or store current-organization failures with the same organization identifier so normal retryable error UI remains reachable.