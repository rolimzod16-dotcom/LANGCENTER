ALTER TABLE groups ADD COLUMN IF NOT EXISTS lesson_time TIME;
ALTER TABLE students ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS telegram_username TEXT;

CREATE INDEX IF NOT EXISTS idx_groups_teacher_time ON groups(teacher_id, lesson_time);
CREATE INDEX IF NOT EXISTS idx_students_telegram_username ON students(telegram_username);
CREATE INDEX IF NOT EXISTS idx_teachers_telegram_username ON teachers(telegram_username);

NOTIFY pgrst, 'reload schema';
SELECT 'hours + telegram_username ready' AS result;
