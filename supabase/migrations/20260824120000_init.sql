-- Lang Center — чистая схема для нового проекта Supabase
-- SQL Editor → вставить целиком → Run (один раз)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO organizations (id, name, slug)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Филиал 1', 'center-1'),
  ('00000000-0000-0000-0000-000000000002', 'Филиал 2', 'center-2')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  phone_digits TEXT,
  student_code TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_plain TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_fee NUMERIC(12,2) DEFAULT 500000,
  start_date DATE DEFAULT CURRENT_DATE,
  payment_due_day INTEGER DEFAULT 10,
  notes TEXT,
  telegram_chat_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  teacher_code TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_plain TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  telegram_chat_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, student_id)
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  score NUMERIC(6,2) NOT NULL,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100,
  comment TEXT,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'present',
  lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, teacher_id, lesson_date)
);

CREATE TABLE IF NOT EXISTS student_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount_due NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  period_month DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, period_month)
);

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES student_payments(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  action TEXT NOT NULL,
  amount NUMERIC(12,2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_admin_chats (
  chat_id BIGINT PRIMARY KEY,
  username TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_sessions (
  chat_id BIGINT NOT NULL,
  bot TEXT NOT NULL DEFAULT 'student',
  state TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, bot)
);

CREATE TABLE IF NOT EXISTS trial_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT,
  telegram_username TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  course TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  admin_note TEXT,
  login_code TEXT,
  plain_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_chat_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_students_org ON students(organization_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);
CREATE INDEX IF NOT EXISTS idx_students_phone_digits ON students(phone_digits);
CREATE INDEX IF NOT EXISTS idx_students_telegram_chat_id
  ON students(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teachers_org ON teachers(organization_id);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);
CREATE INDEX IF NOT EXISTS idx_teachers_code ON teachers(teacher_code);
CREATE INDEX IF NOT EXISTS idx_teachers_telegram_chat_id
  ON teachers(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_groups_org ON groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_group_students_student ON group_students(student_id);
CREATE INDEX IF NOT EXISTS idx_group_students_group ON group_students(group_id);

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_teacher_date ON attendance(teacher_id, lesson_date);

CREATE INDEX IF NOT EXISTS idx_student_payments_org ON student_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_period ON student_payments(period_month);
CREATE INDEX IF NOT EXISTS idx_student_payments_status ON student_payments(status);
CREATE INDEX IF NOT EXISTS idx_student_payments_paid_at ON student_payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);

CREATE INDEX IF NOT EXISTS idx_trial_applications_status
  ON trial_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_applications_chat
  ON trial_applications(telegram_chat_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_admin_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langcenter_all_organizations" ON organizations;
DROP POLICY IF EXISTS "langcenter_all_students" ON students;
DROP POLICY IF EXISTS "langcenter_all_teachers" ON teachers;
DROP POLICY IF EXISTS "langcenter_all_groups" ON groups;
DROP POLICY IF EXISTS "langcenter_all_group_students" ON group_students;
DROP POLICY IF EXISTS "langcenter_all_grades" ON grades;
DROP POLICY IF EXISTS "langcenter_all_attendance" ON attendance;
DROP POLICY IF EXISTS "langcenter_all_student_payments" ON student_payments;
DROP POLICY IF EXISTS "langcenter_all_payment_events" ON payment_events;
DROP POLICY IF EXISTS "langcenter_all_telegram_admin_chats" ON telegram_admin_chats;
DROP POLICY IF EXISTS "langcenter_all_telegram_sessions" ON telegram_sessions;
DROP POLICY IF EXISTS "langcenter_all_trial_applications" ON trial_applications;

CREATE POLICY "langcenter_all_organizations" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_teachers" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_group_students" ON group_students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_grades" ON grades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_student_payments" ON student_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_payment_events" ON payment_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_telegram_admin_chats" ON telegram_admin_chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_telegram_sessions" ON telegram_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "langcenter_all_trial_applications" ON trial_applications FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

SELECT 'Lang Center schema ready' AS result;
