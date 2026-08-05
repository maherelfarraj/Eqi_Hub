/*
# Add open registration check function
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
