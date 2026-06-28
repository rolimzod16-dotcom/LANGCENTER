-- Lang Center — запусти в Supabase SQL Editor (один раз)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  student_code TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Демо языковой центр', 'demo-center')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_part TEXT;
  i INT;
BEGIN
  LOOP
    v_part := '';
    FOR i IN 1..6 LOOP
      v_part := v_part || SUBSTR(v_chars, 1 + FLOOR(RANDOM() * LENGTH(v_chars))::INT, 1);
    END LOOP;
    v_code := 'STU-' || v_year || '-' || v_part;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM students WHERE student_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_student_with_credentials(
  p_org_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  student_code TEXT,
  plain_password TEXT,
  first_name TEXT,
  last_name TEXT
) AS $$
DECLARE
  v_code TEXT;
  v_password TEXT;
  v_id UUID;
BEGIN
  v_code := generate_student_code();
  v_password := SUBSTR(encode(gen_random_bytes(12), 'base64'), 1, 10);

  INSERT INTO students (
    organization_id, first_name, last_name, email, phone, student_code, password_hash
  ) VALUES (
    p_org_id,
    TRIM(p_first_name),
    TRIM(p_last_name),
    NULLIF(TRIM(p_email), ''),
    NULLIF(TRIM(p_phone), ''),
    v_code,
    crypt(v_password, gen_salt('bf'))
  )
  RETURNING students.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_code, v_password, TRIM(p_first_name), TRIM(p_last_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION student_login(p_code TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  first_name TEXT,
  last_name TEXT,
  student_code TEXT,
  email TEXT,
  phone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.organization_id, s.first_name, s.last_name,
    s.student_code, s.email, s.phone
  FROM students s
  WHERE s.student_code = UPPER(TRIM(p_code))
    AND s.is_active = TRUE
    AND s.password_hash = crypt(p_password, s.password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;