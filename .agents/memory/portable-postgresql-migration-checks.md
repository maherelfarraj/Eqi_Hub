---
name: Portable PostgreSQL migration checks
description: How isolated PostgreSQL migration tests remain runnable in local and hosted CI environments.
---

Isolated migration-application tests must discover PostgreSQL executables through an optional binary-directory override and common platform installation directories, rather than assuming `initdb` is on `PATH`.

**Why:** Hosted CI images commonly install PostgreSQL versioned binaries outside the shell PATH. A test that only searches PATH can fail before applying a valid migration, producing a misleading replay failure.

**How to apply:** When adding or changing an isolated PostgreSQL test, keep executable discovery portable for `initdb`, `pg_ctl`, and `psql`; do not weaken or skip the migration test because a runner has a different PostgreSQL layout.