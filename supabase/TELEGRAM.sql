-- Telegram integration for Lang Center
-- Supabase → SQL Editor → Run (можно повторно)

-- Chat IDs of admins/managers who receive lead notifications
CREATE TABLE IF NOT EXISTS telegram_admin_chats (
  chat_id BIGINT PRIMARY KEY,
  username TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link student cabinet to Telegram
ALTER TABLE students ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_students_telegram_chat_id
  ON students(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Multi-step dialogs (заявка / регистрация в боте)
CREATE TABLE IF NOT EXISTS telegram_sessions (
  chat_id BIGINT NOT NULL,
  bot TEXT NOT NULL DEFAULT 'student',
  state TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, bot)
);

-- Заявки на пробный урок (день + время) + решение админа
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
  -- pending | accepted | rejected | registered
  student_id UUID,
  admin_note TEXT,
  login_code TEXT,
  plain_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_chat_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_trial_applications_status
  ON trial_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_applications_chat
  ON trial_applications(telegram_chat_id);

NOTIFY pgrst, 'reload schema';

SELECT 'TELEGRAM: sessions + trial_applications ready' AS result;
