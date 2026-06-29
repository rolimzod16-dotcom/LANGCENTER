-- Безопасная миграция: работает и со схемой full_name/status, и с first_name/last_name/is_active
-- Supabase → SQL Editor → вставить целиком → Run

ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(12,2) DEFAULT 500000;
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT 10;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'first_name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'last_name'
  ) THEN
    UPDATE students
    SET full_name = TRIM(COALESCE(last_name, '') || ' ' || COALESCE(first_name, ''))
    WHERE (full_name IS NULL OR full_name = '')
      AND first_name IS NOT NULL;

    UPDATE students
    SET full_name = TRIM(COALESCE(first_name, ''))
    WHERE (full_name IS NULL OR full_name = '')
      AND first_name IS NOT NULL
      AND (last_name IS NULL OR last_name = '');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'is_active'
  ) THEN
    UPDATE students
    SET status = CASE WHEN is_active IS TRUE THEN 'active' ELSE 'inactive' END
    WHERE status IS NULL;
  END IF;

  UPDATE students SET status = 'active' WHERE status IS NULL;
END $$;

SELECT 'Готово: схема students обновлена.' AS result;