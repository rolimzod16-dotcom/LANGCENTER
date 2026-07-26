-- Telegram integration for Lang Center
-- Supabase → SQL Editor → Run

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

NOTIFY pgrst, 'reload schema';

SELECT 'TELEGRAM: admin_chats + students.telegram_chat_id ready' AS result;
