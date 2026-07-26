-- ============================================================
-- Lang Center — один раз в Supabase → SQL Editor → Run
-- Делает БД совместимой с регистрацией, админкой и журналом
-- ============================================================

-- Students: логин/пароль для админа + поиск
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_plain TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_digits TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(12,2) DEFAULT 500000;
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT 10;

-- Teachers: пароль виден админу (если колонка нужна)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password_plain TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Телефон ученика НЕ уникальный
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'students' AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%phone%'
  LOOP
    EXECUTE format('ALTER TABLE students DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE students
SET phone_digits = NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')
WHERE phone IS NOT NULL AND (phone_digits IS NULL OR phone_digits = '');

UPDATE students SET status = 'active' WHERE status IS NULL;
UPDATE teachers SET status = 'active' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_phone_digits ON students(phone_digits);
CREATE INDEX IF NOT EXISTS idx_teachers_teacher_code ON teachers(teacher_code);

-- Платежи / группы / журнал (если ещё нет)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  score NUMERIC(6,2) NOT NULL,
  max_score NUMERIC(6,2) DEFAULT 100,
  comment TEXT,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

NOTIFY pgrst, 'reload schema';

SELECT 'MAKE_IT_WORK: schema ready' AS result;
