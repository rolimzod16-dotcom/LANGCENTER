import {
  displayName,
  mapRawStudent,
  type RawStudentRow,
} from "@/lib/student-schema";
import { fetchAllStudentsRows } from "@/lib/students";
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

type PaymentDbRow = {
  id: string;
  student_id: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_at: string | null;
  status: string;
  period_month: string;
  note: string | null;
};

function mapPayment(
  row: PaymentDbRow,
  student?: {
    name: string;
    code: string;
    start_date: string | null;
    payment_due_day: number | null;
  },
): StudentPayment {
  const amountDue = Number(row.amount_due);
  const amountPaid = Number(row.amount_paid);
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: student?.name ?? "—",
    student_code: student?.code ?? "—",
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

async function studentLookupMap(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
) {
  const { rows, schema } = await fetchAllStudentsRows(supabase);
  return new Map(
    rows.map((row) => {
      const student = mapRawStudent(row, schema);
      return [
        student.id,
        {
          name: displayName(student),
          code: student.student_code,
          start_date: student.start_date,
          payment_due_day: student.payment_due_day,
          is_active: student.is_active,
          monthly_fee: Number(row.monthly_fee ?? 500000),
        },
      ] as const;
    }),
  );
}

export type PaymentListFilter = "all" | "paid" | "debt" | "overdue" | "new";

export type OwnerPaymentsQuery = {
  periodMonth: string;
  page?: number;
  limit?: number;
  search?: string;
  filter?: PaymentListFilter;
};

export type OwnerPaymentsSummary = {
  total_income: number;
  total_expected: number;
  total_debt: number;
  profit: number;
  paid_count: number;
  debt_count: number;
  overdue_count: number;
  new_count: number;
  billing_count: number;
};

export type PaginatedOwnerPayments = {
  items: StudentPayment[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

async function buildOwnerPaymentsForMonth(
  periodMonth: string,
): Promise<StudentPayment[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { rows, schema } = await fetchAllStudentsRows(supabase);
  const students = rows
    .map((row) => ({ row, student: mapRawStudent(row, schema) }))
    .filter(({ student }) => student.is_active);

  let payments: StudentPayment[] = [];
  try {
    payments = await listPaymentsForMonth(periodMonth);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("student_payments")) throw err;
  }

  const paymentByStudent = new Map(payments.map((p) => [p.student_id, p]));
  const merged: StudentPayment[] = [];

  for (const { row, student } of students) {
    if (!studentStartedInPeriod(student.start_date, periodMonth)) continue;

    const existing = paymentByStudent.get(student.id);
    if (existing) {
      merged.push(existing);
      continue;
    }

    const raw = row as RawStudentRow;
    const fee = Number(raw.monthly_fee ?? 500000);
    const dueDay = Number(student.payment_due_day ?? 10);
    const dueDate = dueDateFromPeriod(periodMonth, dueDay);

    merged.push({
      id: null,
      student_id: student.id,
      student_name: displayName(student),
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

function matchesPaymentFilter(
  payment: StudentPayment,
  filter: PaymentListFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "new") return !payment.has_invoice;
  if (filter === "paid") return payment.status === "paid";
  if (filter === "overdue") return payment.status === "overdue";
  if (filter === "debt") {
    return payment.status !== "paid" && payment.amount_paid < payment.amount_due;
  }
  return true;
}

function matchesPaymentSearch(payment: StudentPayment, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    payment.student_name.toLowerCase().includes(q) ||
    payment.student_code.toLowerCase().includes(q)
  );
}

export function summarizeOwnerPayments(
  payments: StudentPayment[],
): OwnerPaymentsSummary {
  const totalIncome = payments.reduce((s, p) => s + p.amount_paid, 0);
  const totalExpected = payments.reduce((s, p) => s + p.amount_due, 0);
  const totalDebt = payments.reduce(
    (s, p) => s + Math.max(0, p.amount_due - p.amount_paid),
    0,
  );

  return {
    total_income: totalIncome,
    total_expected: totalExpected,
    total_debt: totalDebt,
    profit: totalIncome,
    paid_count: payments.filter((p) => p.status === "paid").length,
    debt_count: payments.filter(
      (p) => p.status !== "paid" && p.amount_paid < p.amount_due,
    ).length,
    overdue_count: payments.filter((p) => p.status === "overdue").length,
    new_count: payments.filter((p) => !p.has_invoice).length,
    billing_count: payments.length,
  };
}

export async function getOwnerPaymentsForMonth(periodMonth: string) {
  return buildOwnerPaymentsForMonth(periodMonth);
}

export async function getOwnerPaymentsSummary(periodMonth: string) {
  const payments = await buildOwnerPaymentsForMonth(periodMonth);
  return summarizeOwnerPayments(payments);
}

export function filterOwnerPayments(
  payments: StudentPayment[],
  filter: PaymentListFilter = "all",
  search = "",
): StudentPayment[] {
  return payments.filter(
    (p) => matchesPaymentFilter(p, filter) && matchesPaymentSearch(p, search),
  );
}

export function paginateOwnerPayments(
  payments: StudentPayment[],
  query: Omit<OwnerPaymentsQuery, "periodMonth">,
): PaginatedOwnerPayments {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const filter = query.filter ?? "all";
  const search = query.search ?? "";

  const filtered = filterOwnerPayments(payments, filter, search);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;

  return {
    items: filtered.slice(start, start + limit),
    total,
    page: safePage,
    limit,
    total_pages: totalPages,
  };
}

export async function getOwnerPaymentsPage(
  query: OwnerPaymentsQuery,
): Promise<PaginatedOwnerPayments> {
  const merged = await buildOwnerPaymentsForMonth(query.periodMonth);
  return paginateOwnerPayments(merged, query);
}

export async function listPaymentsForMonth(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .eq("period_month", periodMonth)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);

  const students = await studentLookupMap(supabase);
  return (data ?? []).map((row) =>
    mapPayment(row as PaymentDbRow, students.get(row.student_id)),
  );
}

export async function generateMonthlyPayments(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const students = await studentLookupMap(supabase);
  const rows = [...students.entries()]
    .filter(([, student]) => student.is_active)
    .filter(([, student]) =>
      studentStartedInPeriod(student.start_date, periodMonth),
    )
    .map(([studentId, student]) => {
      const dueDay = Number(student.payment_due_day ?? 10);
      return {
        student_id: studentId,
        amount_due: student.monthly_fee,
        amount_paid: 0,
        due_date: dueDateFromPeriod(periodMonth, dueDay),
        status: "pending" as const,
        period_month: periodMonth,
      };
    });

  let created = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("student_payments").upsert(batch, {
      onConflict: "student_id,period_month",
      ignoreDuplicates: true,
    });
    if (!error) created += batch.length;
  }

  return { created, total: rows.length };
}

export async function ensureStudentPaymentForMonth(
  studentId: string,
  periodMonth = currentPeriodMonth(),
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const students = await studentLookupMap(supabase);
  const student = students.get(studentId);
  if (!student?.is_active) return null;
  if (!studentStartedInPeriod(student.start_date, periodMonth)) return null;

  const dueDay = Number(student.payment_due_day ?? 10);
  const dueDate = dueDateFromPeriod(periodMonth, dueDay);

  const { data: payment, error: upsertError } = await supabase
    .from("student_payments")
    .upsert(
      {
        student_id: studentId,
        amount_due: student.monthly_fee,
        amount_paid: 0,
        due_date: dueDate,
        status: "pending",
        period_month: periodMonth,
      },
      { onConflict: "student_id,period_month" },
    )
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .single();

  if (upsertError) throw new Error(upsertError.message);
  return mapPayment(payment as PaymentDbRow, student);
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
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .single();

  if (error) throw new Error(error.message);
  const students = await studentLookupMap(supabase);
  return mapPayment(data as PaymentDbRow, students.get(data.student_id));
}

export function periodMonthFromDate(date: string): string {
  const [y, m] = date.split("-");
  return `${y}-${m}-01`;
}

function nextDayIso(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type DailyBreakdownRow = {
  date: string;
  received_total: number;
  received_count: number;
};

export async function listPaymentsReceivedOnDate(date: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const end = nextDayIso(date);
  const { data, error } = await supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .gte("paid_at", `${date}T00:00:00.000Z`)
    .lt("paid_at", `${end}T00:00:00.000Z`)
    .gt("amount_paid", 0)
    .order("paid_at", { ascending: false });

  if (error) throw new Error(error.message);
  const students = await studentLookupMap(supabase);
  return (data ?? []).map((row) =>
    mapPayment(row as PaymentDbRow, students.get(row.student_id)),
  );
}

export function getMonthDailyBreakdown(
  payments: StudentPayment[],
): DailyBreakdownRow[] {
  const map = new Map<string, { received_total: number; received_count: number }>();

  for (const payment of payments) {
    if (!payment.paid_at || payment.amount_paid <= 0) continue;
    const day = payment.paid_at.slice(0, 10);
    const current = map.get(day) ?? { received_total: 0, received_count: 0 };
    current.received_total += payment.amount_paid;
    current.received_count += 1;
    map.set(day, current);
  }

  return [...map.entries()]
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDuePaymentsOnDate(date: string) {
  const periodMonth = periodMonthFromDate(date);
  const merged = await buildOwnerPaymentsForMonth(periodMonth);
  return merged.filter((p) => p.due_date === date);
}

export type DailyReportSection = "received" | "due";

export function summarizeDailyReceived(payments: StudentPayment[]) {
  return {
    received_total: payments.reduce((s, p) => s + p.amount_paid, 0),
    received_count: payments.length,
  };
}

export function summarizeDailyDue(payments: StudentPayment[]) {
  const unpaid = payments.filter(
    (p) => p.status !== "paid" && p.amount_paid < p.amount_due,
  );
  return {
    due_today_total: payments.reduce((s, p) => s + p.amount_due, 0),
    due_today_count: payments.length,
    due_today_unpaid_total: unpaid.reduce(
      (s, p) => s + Math.max(0, p.amount_due - p.amount_paid),
      0,
    ),
    due_today_unpaid_count: unpaid.length,
  };
}

export function currentPeriodMonth(): string {
  return monthStart(new Date());
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(amount)) + " сум";
}