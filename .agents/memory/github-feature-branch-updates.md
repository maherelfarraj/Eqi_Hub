---
name: GitHub feature branch updates
description: Reliable GitHub integration workflow for updating a feature branch whose name contains slashes.
---

For feature branch names containing `/`, verify the current remote head with GitHub’s matching-refs endpoint and update it through the plural `git/refs/{ref}` endpoint.

**Why:** The singular get-ref path can return a misleading 404 for slash-named refs, and pull-request reads may temporarily return a cached head SHA after a successful ref update.

**How to apply:** Base a new tree and commit on the PR head, patch the plural ref endpoint with `force: false` (URL-encode slash separators in the ref path), then confirm the branch via matching refs or `git ls-remote` before reporting that the PR was updated.