/*
# Add open registration check function

1. New Function
  - `is_open_registration()` - Returns true when zero owners exist AND bootstrap
    has not been completed. Callable by anon (pre-authentication check).
    SECURITY DEFINER so it can read user_roles regardless of caller's RLS.

2. Security
  - Function is read-only, returns a single boolean
  - Pinned search_path prevents injection
  - Grants EXECUTE to anon and authenticated so the sign-up page can query it
*/

CREATE OR REPLACE FUNCTION is_open_registration()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'owner'
  )
  AND NOT EXISTS (
    SELECT 1 FROM app_settings
    WHERE key = 'bootstrap_completed' AND value::text = 'true'
  );
$$;

GRANT EXECUTE ON FUNCTION is_open_registration() TO anon;
GRANT EXECUTE ON FUNCTION is_open_registration() TO authenticated;
