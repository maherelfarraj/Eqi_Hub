/*
# Security Helper Functions and RLS Policies

1. Helper Functions (SECURITY DEFINER with pinned search_path)
  - `get_user_roles(uid)` - Returns all role names for a user
  - `has_role(uid, role_name)` - Checks if a user has a specific role
  - `is_staff(uid)` - Checks if a user has any staff role
  - `same_branch(uid, branch_id)` - Checks if user belongs to a branch
  - `get_user_role_rank(uid)` - Returns the lowest (most powerful) rank for a user

2. Audit Trigger Functions
  - `audit_user_roles_change()` - Logs inserts/deletes on user_roles
  - `audit_invitations_change()` - Logs invitation events
  - `audit_app_settings_change()` - Logs settings changes

3. Privilege Escalation Prevention
  - `prevent_privilege_escalation()` - Trigger that prevents assigning roles
    more powerful than the actor's own role

4. RLS Policies on all tables
  - branches: staff can read, owner/manager can write
  - roles: all authenticated can read
  - profiles: own profile read/write, staff can read all active
  - user_roles: owner/manager can manage, user can read own
  - app_settings: staff can read, owner/manager can write
  - audit_logs: owner/manager can read, insert only via triggers
  - invitations: owner/manager can manage, user can read own pending
*/

-- Helper: get all role names for a user
CREATE OR REPLACE FUNCTION get_user_roles(uid uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(r.name), '{}')
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = uid;
$$;

-- Helper: check if user has a specific role
CREATE OR REPLACE FUNCTION has_role(uid uuid, role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = uid AND r.name = role_name
  );
$$;

-- Helper: check if user is any staff role
CREATE OR REPLACE FUNCTION is_staff(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = uid
    AND r.name IN ('owner', 'school_manager', 'receptionist', 'instructor', 'stable_manager', 'groom', 'veterinarian', 'accountant')
  );
$$;

-- Helper: check branch membership
CREATE OR REPLACE FUNCTION same_branch(uid uuid, bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND (p.branch_id = bid OR bid IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = uid AND (ur.branch_id = bid OR ur.branch_id IS NULL)
  );
$$;

-- Helper: get user's most powerful role rank
CREATE OR REPLACE FUNCTION get_user_role_rank(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(MIN(r.rank), 99)
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = uid;
$$;

-- Trigger: prevent privilege escalation on user_roles insert
CREATE OR REPLACE FUNCTION prevent_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
  actor_rank integer;
  target_rank integer;
BEGIN
  actor_rank := get_user_role_rank(auth.uid());
  SELECT rank INTO target_rank FROM roles WHERE id = NEW.role_id;

  IF target_rank < actor_rank THEN
    RAISE EXCEPTION 'Cannot assign a role more powerful than your own';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS check_privilege_escalation ON user_roles;
CREATE TRIGGER check_privilege_escalation
  BEFORE INSERT ON user_roles
  FOR EACH ROW EXECUTE FUNCTION prevent_privilege_escalation();

-- Audit trigger: user_roles changes
CREATE OR REPLACE FUNCTION audit_user_roles_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, after)
    VALUES (auth.uid(), 'role_assigned', 'user_roles', NEW.id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, before)
    VALUES (auth.uid(), 'role_removed', 'user_roles', OLD.id, row_to_json(OLD)::jsonb);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS audit_user_roles ON user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_user_roles_change();

-- Audit trigger: invitations changes
CREATE OR REPLACE FUNCTION audit_invitations_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, after)
    VALUES (auth.uid(), 'invitation_created', 'invitations', NEW.id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' AND NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, before, after)
    VALUES (auth.uid(), 'invitation_accepted', 'invitations', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS audit_invitations ON invitations;
CREATE TRIGGER audit_invitations
  AFTER INSERT OR UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION audit_invitations_change();

-- Audit trigger: app_settings changes
CREATE OR REPLACE FUNCTION audit_app_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, table_name, record_id, before, after)
  VALUES (auth.uid(), 'settings_updated', 'app_settings', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS audit_app_settings ON app_settings;
CREATE TRIGGER audit_app_settings
  AFTER UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION audit_app_settings_change();

-- ===== RLS POLICIES =====

-- BRANCHES: staff can read active branches, owner/manager can manage
DROP POLICY IF EXISTS "staff_read_branches" ON branches;
CREATE POLICY "staff_read_branches" ON branches FOR SELECT
  TO authenticated USING (is_staff(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "manager_insert_branches" ON branches;
CREATE POLICY "manager_insert_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager')
  );

DROP POLICY IF EXISTS "manager_update_branches" ON branches;
CREATE POLICY "manager_update_branches" ON branches FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager'))
  WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager'));

DROP POLICY IF EXISTS "owner_delete_branches" ON branches;
CREATE POLICY "owner_delete_branches" ON branches FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'owner'));

-- ROLES: all authenticated can read
DROP POLICY IF EXISTS "authenticated_read_roles" ON roles;
CREATE POLICY "authenticated_read_roles" ON roles FOR SELECT
  TO authenticated USING (true);

-- PROFILES: own profile + staff can read all active
DROP POLICY IF EXISTS "read_own_or_staff_profiles" ON profiles;
CREATE POLICY "read_own_or_staff_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid() OR is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager'))
  WITH CHECK (id = auth.uid() OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager'));

DROP POLICY IF EXISTS "no_delete_profiles" ON profiles;
CREATE POLICY "no_delete_profiles" ON profiles FOR DELETE
  TO authenticated USING (false);

-- USER_ROLES: owner/manager can manage, users can read their own
DROP POLICY IF EXISTS "read_own_or_manager_user_roles" ON user_roles;
CREATE POLICY "read_own_or_manager_user_roles" ON user_roles FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'school_manager')
  );

DROP POLICY IF EXISTS "manager_insert_user_roles" ON user_roles;
CREATE POLICY "manager_insert_user_roles" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (
    (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager'))
    AND user_id != auth.uid()
  );

DROP POLICY IF EXISTS "manager_delete_user_roles" ON user_roles;
CREATE POLICY "manager_delete_user_roles" ON user_roles FOR DELETE
  TO authenticated USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager')
  );

DROP POLICY IF EXISTS "no_update_user_roles" ON user_roles;
CREATE POLICY "no_update_user_roles" ON user_roles FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

-- APP_SETTINGS: staff can read, owner/manager can write
DROP POLICY IF EXISTS "staff_read_settings" ON app_settings;
CREATE POLICY "staff_read_settings" ON app_settings FOR SELECT
  TO authenticated USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "manager_insert_settings" ON app_settings;
CREATE POLICY "manager_insert_settings" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager')
  );

DROP POLICY IF EXISTS "manager_update_settings" ON app_settings;
CREATE POLICY "manager_update_settings" ON app_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager'))
  WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager'));

DROP POLICY IF EXISTS "no_delete_settings" ON app_settings;
CREATE POLICY "no_delete_settings" ON app_settings FOR DELETE
  TO authenticated USING (false);

-- AUDIT_LOGS: owner/manager can read, no one can update/delete
DROP POLICY IF EXISTS "manager_read_audit" ON audit_logs;
CREATE POLICY "manager_read_audit" ON audit_logs FOR SELECT
  TO authenticated USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager')
  );

DROP POLICY IF EXISTS "no_insert_audit_direct" ON audit_logs;
CREATE POLICY "no_insert_audit_direct" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_update_audit" ON audit_logs;
CREATE POLICY "no_update_audit" ON audit_logs FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_audit" ON audit_logs;
CREATE POLICY "no_delete_audit" ON audit_logs FOR DELETE
  TO authenticated USING (false);

-- INVITATIONS: owner/manager can manage, user can read their own pending
DROP POLICY IF EXISTS "read_invitations" ON invitations;
CREATE POLICY "read_invitations" ON invitations FOR SELECT
  TO authenticated USING (
    has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'school_manager')
    OR (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "manager_insert_invitations" ON invitations;
CREATE POLICY "manager_insert_invitations" ON invitations FOR INSERT
  TO authenticated WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'school_manager')
  );

DROP POLICY IF EXISTS "manager_update_invitations" ON invitations;
CREATE POLICY "manager_update_invitations" ON invitations FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'school_manager')
    OR (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'school_manager')
    OR (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "no_delete_invitations" ON invitations;
CREATE POLICY "no_delete_invitations" ON invitations FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'owner'));
