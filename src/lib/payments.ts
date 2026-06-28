import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PaymentStatus = "pending" | "paid" | "partial" | "overdue";

export type StudentPayment = {
  id: string | null;
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
  start_date: string | null;
  payment_due_day: number | null;
  has_invoice: boolean;
};

function monthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function dueDateFromPeriod(periodMonth: string, day = 10): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const safeDay = Math.min(Math.max(day, 1), 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

export function studentStartedInPeriod(
  startDate: string | null,
  periodMonth: string,
): boolean {
  if (!startDate) return true;
  const [y, m] = periodMonth.split("-").map(Number);
  const periodEnd = `${y}-${String(m).padStart(2, "0")}-31`;
  return startDate <= periodEnd;
}

export function computeStatus(
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
  students?:
    | {
        full_name: string;
        student_code: string;
        start_date?: string | null;
        payment_due_day?: number | null;
      }
    | {
        full_name: string;
        student_code: string;
        start_date?: string | null;
        payment_due_day?: number | null;
      }[];
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
    start_date: student?.start_date ?? null,
    payment_due_day: student?.payment_due_day ?? null,
    has_invoice: true,
  };
}

export async function getOwnerPaymentsForMonth(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select(
      "id, full_name, student_code, monthly_fee, start_date, payment_due_day",
    )
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (studentsError) throw new Error(studentsError.message);

  let payments: StudentPayment[] = [];
  try {
    payments = await listPaymentsForMonth(periodMonth);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("student_payments")) throw err;
  }

  const paymentByStudent = new Map(payments.map((p) => [p.student_id, p]));
  const merged: StudentPayment[] = [];

  for (const student of students ?? []) {
    if (!studentStartedInPeriod(student.start_date, periodMonth)) continue;

    const existing = paymentByStudent.get(student.id);
    if (existing) {
      merged.push(existing);
      continue;
    }

    const fee = Number(student.monthly_fee ?? 500000);
    const dueDay = Number(student.payment_due_day ?? 10);
    const dueDate = dueDateFromPeriod(periodMonth, dueDay);

    merged.push({
      id: null,
      student_id: student.id,
      student_name: student.full_name,
      student_code: student.student_code,
      amount_due: fee,
      amount_paid: 0,
      due_date: dueDate,
      paid_at: null,
      status: computeStatus(fee, 0, dueDate),
      period_month: periodMonth,
      note: null,
      start_date: student.start_date ?? null,
      payment_due_day: student.payment_due_day ?? null,
      has_invoice: false,
    });
  }

  return merged.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export async function listPaymentsForMonth(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note, students(full_name, student_code, start_date, payment_due_day)",
    )
    .eq("period_month", periodMonth)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPayment);
}

export async function generateMonthlyPayments(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, monthly_fee, start_date, payment_due_day")
    .eq("status", "active");

  if (studentsError) throw new Error(studentsError.message);

  let created = 0;
  for (const student of students ?? []) {
    if (!studentStartedInPeriod(student.start_date, periodMonth)) continue;
    const fee = Number(student.monthly_fee ?? 500000);
    const dueDay = Number(student.payment_due_day ?? 10);
    const dueDate = dueDateFromPeriod(periodMonth, dueDay);
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

export async function ensureStudentPaymentForMonth(
  studentId: string,
  periodMonth = currentPeriodMonth(),
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: student, error } = await supabase
    .from("students")
    .select("id, monthly_fee, start_date, payment_due_day, status")
    .eq("id", studentId)
    .single();

  if (error) throw new Error(error.message);
  if (student.status !== "active") return null;
  if (!studentStartedInPeriod(student.start_date, periodMonth)) return null;

  const fee = Number(student.monthly_fee ?? 500000);
  const dueDay = Number(student.payment_due_day ?? 10);
  const dueDate = dueDateFromPeriod(periodMonth, dueDay);

  const { data: payment, error: upsertError } = await supabase
    .from("student_payments")
    .upsert(
      {
        student_id: studentId,
        amount_due: fee,
        amount_paid: 0,
        due_date: dueDate,
        status: "pending",
        period_month: periodMonth,
      },
      { onConflict: "student_id,period_month" },
    )
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note, students(full_name, student_code, start_date, payment_due_day)",
    )
    .single();

  if (upsertError) throw new Error(upsertError.message);
  return mapPayment(payment);
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
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note, students(full_name, student_code, start_date, payment_due_day)",
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