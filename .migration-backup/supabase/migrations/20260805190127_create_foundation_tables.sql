/*
# Pay & Ride Foundation Schema

1. New Tables
  - `branches` - Physical riding school locations
  - `roles` - Fixed role definitions
  - `profiles` - Extended user profiles linked to auth.users
  - `user_roles` - Role assignments (many-to-many users-roles-branches)
  - `app_settings` - Key-value application settings per branch
  - `audit_logs` - Immutable audit trail
  - `invitations` - Invitation-only membership

2. Trigger Functions
  - `set_updated_at()` - Auto-maintains updated_at on UPDATE
  - `set_updated_by()` - Auto-sets updated_by from auth.uid()

3. Seed Data
  - 11 fixed roles
  - Default app_settings: timezone, currency, date_format, tax_rate

4. Security
  - RLS enabled on ALL tables
*/

-- Trigger function: auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: auto-set updated_by from auth.uid()
CREATE OR REPLACE FUNCTION set_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  timezone text NOT NULL DEFAULT 'Asia/Amman',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz
);

CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER branches_updated_by
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_by();

-- Roles table (fixed set)
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  rank integer NOT NULL DEFAULT 99
);

-- Seed roles with rank (lower = more powerful)
INSERT INTO roles (name, description, rank) VALUES
  ('owner', 'System owner with full access', 1),
  ('school_manager', 'School manager with broad access', 2),
  ('receptionist', 'Front desk operations', 3),
  ('instructor', 'Riding instructor', 4),
  ('stable_manager', 'Stable operations manager', 5),
  ('groom', 'Horse care staff', 6),
  ('veterinarian', 'Veterinary professional', 7),
  ('accountant', 'Financial operations', 8),
  ('adult_rider', 'Adult rider/member', 10),
  ('parent_guardian', 'Parent or guardian of junior riders', 11),
  ('junior_rider', 'Junior rider (under 18)', 12)
ON CONFLICT (name) DO NOTHING;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  preferred_language text NOT NULL DEFAULT 'en',
  branch_id uuid REFERENCES branches(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER profiles_updated_by
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_by();

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, role_id, branch_id)
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(key, branch_id)
);

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Audit logs table (insert-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  branch_id uuid REFERENCES branches(id),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Seed default app_settings
INSERT INTO app_settings (key, value) VALUES
  ('timezone', '"Asia/Amman"'),
  ('currency', '"JOD"'),
  ('date_format', '"DD/MM/YYYY"'),
  ('tax_rate', '0.16')
ON CONFLICT (key, branch_id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
