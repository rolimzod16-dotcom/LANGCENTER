-- ЗАПУСТИ ОДИН РАЗ в Supabase → SQL Editor → Run
-- Удаляет старую таблицу students и создаёт правильную схему

DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
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

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  UNIQUE (organization_id, name)
);

INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Демо языковой центр', 'demo-center');

SELECT 'Готово! Таблицы созданы.' AS result;