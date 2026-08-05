/*
# Auto-create profile on user signup + invitation acceptance function
*/

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, created_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Accept invitation function
CREATE OR REPLACE FUNCTION accept_invitation(token_input text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv record;
  caller_id uuid;
  caller_email text;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO caller_email FROM auth.users WHERE id = caller_id;

  SELECT * INTO inv FROM invitations
  WHERE token = token_input
    AND accepted_at IS NULL
    AND deleted_at IS NULL
    AND expires_at > now();

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF lower(inv.email) != lower(caller_email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  -- Assign the role
  INSERT INTO user_roles (user_id, role_id, branch_id, created_by)
  VALUES (caller_id, inv.role_id, inv.branch_id, inv.invited_by)
  ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;

  -- Mark invitation accepted
  UPDATE invitations SET accepted_at = now() WHERE id = inv.id;

  -- Update profile with branch if set
  IF inv.branch_id IS NOT NULL THEN
    UPDATE profiles SET branch_id = inv.branch_id WHERE id = caller_id AND branch_id IS NULL;
  END IF;

  RETURN jsonb_build_object('success', true, 'role_id', inv.role_id, 'branch_id', inv.branch_id);
END;
$$;
