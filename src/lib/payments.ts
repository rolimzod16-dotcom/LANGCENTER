import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PaymentStatus = "pending" | "paid" | "partial" | "overdue";

export type StudentPayment = {
  id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_at: string | null;
  status: PaymentStatus;
  period_month: string;
  note: string | null;
};

function monthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function dueDateForMonth(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}-10`;
}

function computeStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: string,
): PaymentStatus {
  if (amountPaid >= amountDue) return "paid";
  const today = new Date().toISOString().slice(0, 10);
  if (amountPaid > 0) return dueDate < today ? "overdue" : "partial";
  return dueDate < today ? "overdue" : "pending";
}

function mapPayment(row: {
  id: string;
  student_id: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_at: string | null;
  status: string;
  period_month: string;
  note: string | null;
  students?: { full_name: string; student_code: string } | { full_name: string; student_code: string }[];
}): StudentPayment {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  const amountDue = Number(row.amount_due);
  const amountPaid = Number(row.amount_paid);
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: student?.full_name ?? "—",
    student_code: student?.student_code ?? "—",
    amount_due: amountDue,
    amount_paid: amountPaid,
    due_date: row.due_date,
    paid_at: row.paid_at,
    status: computeStatus(amountDue, amountPaid, row.due_date),
    period_month: row.period_month,
    note: row.note,
  };
}

export async function listPaymentsForMonth(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note, students(full_name, student_code)",
    )
    .eq("period_month", periodMonth)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPayment);
}

export async function generateMonthlyPayments(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const [y, m] = periodMonth.split("-").map(Number);
  const periodDate = new Date(y, m - 1, 1);
  const dueDate = dueDateForMonth(periodDate);

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, monthly_fee")
    .eq("status", "active");

  if (studentsError) throw new Error(studentsError.message);

  let created = 0;
  for (const student of students ?? []) {
    const fee = Number(student.monthly_fee ?? 500000);
    const { error } = await supabase.from("student_payments").upsert(
      {
        student_id: student.id,
        amount_due: fee,
        amount_paid: 0,
        due_date: dueDate,
        status: "pending",
        period_month: periodMonth,
      },
      { onConflict: "student_id,period_month", ignoreDuplicates: true },
    );
    if (!error) created++;
  }

  return { created, total: students?.length ?? 0 };
}

export async function markPaymentPaid(paymentId: string, amountPaid?: number) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: existing, error: fetchError } = await supabase
    .from("student_payments")
    .select("amount_due")
    .eq("id", paymentId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const paid = amountPaid ?? Number(existing.amount_due);
  const status = paid >= Number(existing.amount_due) ? "paid" : "partial";

  const { data, error } = await supabase
    .from("student_payments")
    .update({
      amount_paid: paid,
      paid_at: new Date().toISOString(),
      status,
    })
    .eq("id", paymentId)
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note, students(full_name, student_code)",
    )
    .single();

  if (error) throw new Error(error.message);
  return mapPayment(data);
}

export function currentPeriodMonth(): string {
  return monthStart(new Date());
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(amount)) + " сум";
}