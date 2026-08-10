/*
# Fix privilege escalation trigger for service-role operations
*/

CREATE OR REPLACE FUNCTION prevent_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
  actor_rank integer;
  target_rank integer;
BEGIN
  -- Service-role operations (auth.uid() is NULL) are trusted server-side actions
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_rank := get_user_role_rank(auth.uid());
  SELECT rank INTO target_rank FROM roles WHERE id = NEW.role_id;

  IF target_rank < actor_rank THEN
    RAISE EXCEPTION 'Cannot assign a role more powerful than your own';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
