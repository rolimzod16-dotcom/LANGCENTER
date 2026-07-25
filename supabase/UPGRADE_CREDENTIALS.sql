-- Lang Center: пароль виден админу + поиск по телефону
-- Supabase → SQL Editor → Run (целиком)

-- Пароль в открытом виде только для админ-панели (вход идёт через password_hash)
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- Только цифры телефона для поиска
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_digits TEXT;

-- Заметка: курс / смена при записи с сайта
ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;

-- На всякий случай — базовые колонки (если старая БД)
ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(12,2) DEFAULT 500000;
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT 10;

-- Телефон НЕ уникальный (несколько учеников / один номер родителя)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'students'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%phone%'
  LOOP
    EXECUTE format('ALTER TABLE students DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE students
SET phone_digits = NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')
WHERE phone IS NOT NULL
  AND (phone_digits IS NULL OR phone_digits = '');

CREATE INDEX IF NOT EXISTS idx_students_phone_digits ON students(phone_digits);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);
CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code);

-- Обновить schema cache PostgREST (иногда помогает)
NOTIFY pgrst, 'reload schema';

SELECT 'UPGRADE_CREDENTIALS: password_plain + phone_digits + notes — готово.' AS result;
