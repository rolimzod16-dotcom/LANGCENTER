-- Запусти в Supabase SQL Editor (один раз)

ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(12,2) DEFAULT 500000;

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

CREATE INDEX IF NOT EXISTS idx_student_payments_period ON student_payments(period_month);
CREATE INDEX IF NOT EXISTS idx_student_payments_status ON student_payments(status);