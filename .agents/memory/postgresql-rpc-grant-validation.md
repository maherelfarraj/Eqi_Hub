---
name: PostgreSQL RPC grant validation
description: Why migrations that define security-definer RPCs need an isolated PostgreSQL application check.
---

When a migration defines or changes PostgreSQL RPCs, validate it against a disposable PostgreSQL database in addition to static checks. `GRANT EXECUTE ON FUNCTION` and `REVOKE` resolve functions by their exact argument signature; a single omitted parameter aborts the migration transaction.

**Why:** SQL text can look internally consistent while PostgreSQL rejects a grant for a function signature that does not exist, preventing all schema changes in that transactional migration from applying.

**How to apply:** Keep the test database isolated and ephemeral, create only the minimal predecessor schema needed for the target migration, and assert the identity arguments of sensitive RPCs after application. Do not use development or production databases for this validation.