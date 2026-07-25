-- Lang Center: пароль всегда виден админу + поиск по телефону (несколько учеников на 1 номер)
-- Supabase → SQL Editor → Run

-- Пароль в открытом виде только для админ-панели (логин по-прежнему через password_hash)
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- Только цифры телефона для поиска (формат +998… / 90-123-45-67 не мешает)
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_digits TEXT;

-- Телефон НЕ уникальный: братья/сёстры / один родитель — несколько учеников
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

-- Backfill phone_digits
UPDATE students
SET phone_digits = NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')
WHERE phone IS NOT NULL
  AND (phone_digits IS NULL OR phone_digits = '');

CREATE INDEX IF NOT EXISTS idx_students_phone_digits ON students(phone_digits);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);

SELECT 'UPGRADE_CREDENTIALS: password_plain + phone_digits — готово.' AS result;
