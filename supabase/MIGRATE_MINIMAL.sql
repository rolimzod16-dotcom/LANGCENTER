-- Минимальная миграция (30 секунд)
-- Supabase → SQL Editor → вставить → Run

ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;