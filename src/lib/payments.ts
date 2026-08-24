import {
  displayName,
  mapRawStudent,
  type RawStudentRow,
} from "@/lib/student-schema";
import { fetchAllStudentsRows } from "@/lib/students";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Lazy server-only org helpers — avoid pulling next/headers into client bundles. */
async function resolveAdminOrgId(): Promise<string | null> {
  const { getAdminOrgId } = await import("@/lib/org");
  return getAdminOrgId();
}

async function resolveOrgInsertFields(
  orgId?: string | null,
): Promise<Record<string, string>> {
  const { orgInsertFields } = await import("@/lib/org");
  return orgInsertFields(orgId);
}

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

/** Следующий период: 2026-10-01 → 2026-11-01 */
export function nextPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return monthStart(d);
}

/** Предыдущий период */
export function prevPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return monthStart(d);
}

export type StudentBillingCycle = {
  student_id: string;
  payment_due_day: number;
  /** Текущий месяц (YYYY-MM-01) */
  period_month: string;
  /** Срок оплаты текущего цикла, напр. 2026-10-10 */
  due_date: string;
  /** Следующий срок после оплаты, напр. 2026-11-10 */
  next_due_date: string;
  status: PaymentStatus | "new";
  amount_due: number;
  amount_paid: number;
  debt: number;
  has_invoice: boolean;
  payment_id: string | null;
  paid_at: string | null;
  /** Можно нажать «Оплатил» */
  can_mark_paid: boolean;
  /** Можно нажать «Не оплатил» (сброс) */
  can_mark_unpaid: boolean;
  label: string;
};

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
  organizationId?: string | null,
) {
  const { rows, schema } = await fetchAllStudentsRows(supabase, organizationId);
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
  organizationId?: string | null,
): Promise<StudentPayment[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const orgId =
    organizationId === undefined ? await resolveAdminOrgId() : organizationId;

  const { rows, schema } = await fetchAllStudentsRows(supabase, orgId);
  const students = rows
    .map((row) => ({ row, student: mapRawStudent(row, schema) }))
    .filter(({ student }) => student.is_active);

  let payments: StudentPayment[] = [];
  try {
    payments = await listPaymentsForMonth(periodMonth, orgId);
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

  return sortOwnerPayments(merged);
}

const STATUS_SORT_ORDER: Record<string, number> = {
  overdue: 0,
  pending: 1,
  partial: 2,
  new: 3,
  paid: 4,
};

function paymentSortKey(payment: StudentPayment): string {
  const statusKey = !payment.has_invoice ? "new" : payment.status;
  const order = String(STATUS_SORT_ORDER[statusKey] ?? 99).padStart(2, "0");
  return `${order}|${payment.student_name.toLocaleLowerCase("ru")}|${payment.student_code}`;
}

export function sortOwnerPayments(payments: StudentPayment[]): StudentPayment[] {
  return [...payments].sort((a, b) =>
    paymentSortKey(a).localeCompare(paymentSortKey(b), "ru"),
  );
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

export async function getOwnerPaymentsForMonth(
  periodMonth: string,
  organizationId?: string | null,
) {
  return buildOwnerPaymentsForMonth(periodMonth, organizationId);
}

export async function getOwnerPaymentsSummary(
  periodMonth: string,
  organizationId?: string | null,
) {
  const payments = await buildOwnerPaymentsForMonth(periodMonth, organizationId);
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

export async function listPaymentsForMonth(
  periodMonth: string,
  organizationId?: string | null,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const orgId =
    organizationId === undefined ? await resolveAdminOrgId() : organizationId;

  let query = supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .eq("period_month", periodMonth)
    .order("due_date", { ascending: true });

  if (orgId) {
    query = query.eq("organization_id", orgId);
  }

  let { data, error } = await query;

  if (error?.message.toLowerCase().includes("organization_id")) {
    const fallback = await supabase
      .from("student_payments")
      .select(
        "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
      )
      .eq("period_month", periodMonth)
      .order("due_date", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);

  const students = await studentLookupMap(supabase, orgId);
  return (data ?? []).map((row) =>
    mapPayment(row as PaymentDbRow, students.get(row.student_id)),
  );
}

export async function generateMonthlyPayments(periodMonth: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const orgId = await resolveAdminOrgId();
  const orgFields = await resolveOrgInsertFields(orgId);
  const students = await studentLookupMap(supabase, orgId);
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
        ...orgFields,
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
    if (!error) {
      created += batch.length;
      continue;
    }
    // retry without organization_id if column missing
    if (error.message.toLowerCase().includes("organization_id")) {
      const stripped = batch.map((row) => {
        const copy = { ...row } as Record<string, unknown>;
        delete copy.organization_id;
        return copy;
      });
      const retry = await supabase.from("student_payments").upsert(stripped, {
        onConflict: "student_id,period_month",
        ignoreDuplicates: true,
      });
      if (!retry.error) created += stripped.length;
      else throw new Error(retry.error.message);
    } else {
      throw new Error(error.message);
    }
  }

  return { created, total: rows.length };
}

export async function ensureStudentPaymentForMonth(
  studentId: string,
  periodMonth = currentPeriodMonth(),
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const orgId = await resolveAdminOrgId();
  const orgFields = await resolveOrgInsertFields(orgId);
  const students = await studentLookupMap(supabase, orgId);
  const student = students.get(studentId);
  if (!student?.is_active) return null;
  if (!studentStartedInPeriod(student.start_date, periodMonth)) return null;

  const dueDay = Number(student.payment_due_day ?? 10);
  const dueDate = dueDateFromPeriod(periodMonth, dueDay);

  // Уже есть счёт — не перезаписываем (иначе сбросится «оплатил»)
  const existing = await supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .eq("student_id", studentId)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (!existing.error && existing.data) {
    return mapPayment(existing.data as PaymentDbRow, student);
  }

  const payload = {
    student_id: studentId,
    amount_due: student.monthly_fee,
    amount_paid: 0,
    due_date: dueDate,
    status: "pending",
    period_month: periodMonth,
    ...orgFields,
  };

  let { data: payment, error: insertError } = await supabase
    .from("student_payments")
    .insert(payload)
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .single();

  if (insertError?.message.toLowerCase().includes("organization_id")) {
    const rest = { ...payload } as Record<string, unknown>;
    delete rest.organization_id;
    const retry = await supabase
      .from("student_payments")
      .insert(rest)
      .select(
        "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
      )
      .single();
    payment = retry.data;
    insertError = retry.error;
  }

  // race: already created
  if (insertError?.code === "23505" || insertError?.message.includes("duplicate")) {
    const again = await supabase
      .from("student_payments")
      .select(
        "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
      )
      .eq("student_id", studentId)
      .eq("period_month", periodMonth)
      .single();
    if (again.error) throw new Error(again.error.message);
    return mapPayment(again.data as PaymentDbRow, student);
  }

  if (insertError) throw new Error(insertError.message);
  return mapPayment(payment as PaymentDbRow, student);
}

function billingLabel(
  status: PaymentStatus | "new",
  dueDate: string,
  nextDue: string,
): string {
  if (status === "paid") return `Оплатил · след. ${formatDateShort(nextDue)}`;
  if (status === "overdue") return `Просрочено · срок ${formatDateShort(dueDate)}`;
  if (status === "partial") return `Частично · срок ${formatDateShort(dueDate)}`;
  if (status === "new") return `Нет счёта · срок ${formatDateShort(dueDate)}`;
  return `Не оплатил · срок ${formatDateShort(dueDate)}`;
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function buildBillingCycle(
  studentId: string,
  dueDay: number,
  periodMonth: string,
  payment: StudentPayment | null,
  fee: number,
): StudentBillingCycle {
  const dueDate = payment?.due_date ?? dueDateFromPeriod(periodMonth, dueDay);
  const nextDue = dueDateFromPeriod(nextPeriodMonth(periodMonth), dueDay);
  const amountDue = payment?.amount_due ?? fee;
  const amountPaid = payment?.amount_paid ?? 0;
  const status: PaymentStatus | "new" = !payment
    ? computeStatus(amountDue, 0, dueDate) === "overdue"
      ? "overdue"
      : "new"
    : payment.status;
  const hasInvoice = Boolean(payment?.has_invoice);
  const isPaid = status === "paid";

  return {
    student_id: studentId,
    payment_due_day: dueDay,
    period_month: periodMonth,
    due_date: dueDate,
    next_due_date: nextDue,
    status,
    amount_due: amountDue,
    amount_paid: amountPaid,
    debt: Math.max(0, amountDue - amountPaid),
    has_invoice: hasInvoice,
    payment_id: payment?.id ?? null,
    paid_at: payment?.paid_at ?? null,
    can_mark_paid: !isPaid,
    can_mark_unpaid: isPaid || amountPaid > 0,
    label: billingLabel(status, dueDate, nextDue),
  };
}

/**
 * Статусы оплаты текущего месяца для списка учеников (batch).
 * Цикл: день оплаты N → после «Оплатил» следующий срок N-е число след. месяца.
 */
async function studentMetaByIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  studentIds: string[],
) {
  type Meta = {
    name: string;
    code: string;
    start_date: string | null;
    payment_due_day: number | null;
    is_active: boolean;
    monthly_fee: number;
  };
  const map = new Map<string, Meta>();
  if (!studentIds.length) return map;

  const chunkSize = 100;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    for (const select of [
      "id, full_name, student_code, start_date, payment_due_day, status, monthly_fee",
      "id, first_name, last_name, student_code, is_active, monthly_fee",
    ]) {
      const { data, error } = await supabase
        .from("students")
        .select(select)
        .in("id", chunk);
      if (error) continue;
      for (const raw of data ?? []) {
        const row = raw as unknown as {
          id: string;
          full_name?: string;
          first_name?: string;
          last_name?: string;
          student_code: string;
          start_date?: string | null;
          payment_due_day?: number | null;
          status?: string | null;
          is_active?: boolean | null;
          monthly_fee?: number | null;
        };
        const name =
          row.full_name?.trim() ||
          `${row.last_name ?? ""} ${row.first_name ?? ""}`.trim() ||
          row.student_code;
        map.set(row.id, {
          name,
          code: row.student_code,
          start_date: row.start_date ?? null,
          payment_due_day: row.payment_due_day ?? 10,
          is_active:
            row.status !== undefined
              ? row.status === "active"
              : (row.is_active ?? true),
          monthly_fee: Number(row.monthly_fee ?? 500000),
        });
      }
      break;
    }
  }
  return map;
}

export async function getBillingCyclesForStudents(
  studentIds: string[],
  periodMonth = currentPeriodMonth(),
): Promise<Map<string, StudentBillingCycle>> {
  const map = new Map<string, StudentBillingCycle>();
  if (!studentIds.length) return map;

  const supabase = getSupabaseServerClient();
  if (!supabase) return map;

  const students = await studentMetaByIds(supabase, studentIds);

  const paymentsByStudent = new Map<string, StudentPayment>();
  const chunkSize = 100;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("student_payments")
      .select(
        "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
      )
      .eq("period_month", periodMonth)
      .in("student_id", chunk);

    if (error) {
      if (error.message.includes("student_payments")) break;
      continue;
    }
    for (const row of data ?? []) {
      const meta = students.get(row.student_id);
      paymentsByStudent.set(
        row.student_id,
        mapPayment(row as PaymentDbRow, meta),
      );
    }
  }

  for (const id of studentIds) {
    const meta = students.get(id);
    const dueDay = Number(meta?.payment_due_day ?? 10);
    const fee = Number(meta?.monthly_fee ?? 500000);
    const payment = paymentsByStudent.get(id) ?? null;
    map.set(id, buildBillingCycle(id, dueDay, periodMonth, payment, fee));
  }

  return map;
}

/**
 * Офлайн-касса: отметить ученика «Оплатил» / «Не оплатил» за текущий цикл.
 * После «Оплатил» автоматически готовится счёт на следующий месяц (след. N-е число).
 */
export async function setStudentCashStatus(
  studentId: string,
  action: "paid" | "unpaid",
  periodMonth = currentPeriodMonth(),
): Promise<{
  billing: StudentBillingCycle;
  payment: StudentPayment;
  next_payment: StudentPayment | null;
}> {
  const ensured = await ensureStudentPaymentForMonth(studentId, periodMonth);
  if (!ensured?.id) {
    throw new Error("Не удалось создать счёт за месяц");
  }

  let payment: StudentPayment;
  if (action === "paid") {
    payment = await markPaymentPaid(ensured.id);
    // Авто: следующий месяц — «Не оплатил», срок = то же число (+1 месяц)
    let nextPayment: StudentPayment | null = null;
    try {
      nextPayment = await ensureStudentPaymentForMonth(
        studentId,
        nextPeriodMonth(periodMonth),
      );
    } catch {
      nextPayment = null;
    }

    const cycles = await getBillingCyclesForStudents([studentId], periodMonth);
    return {
      billing: cycles.get(studentId)!,
      payment,
      next_payment: nextPayment,
    };
  }

  // unpaid — сброс текущего месяца
  payment = await markPaymentUnpaid(ensured.id);
  const cycles = await getBillingCyclesForStudents([studentId], periodMonth);
  return {
    billing: cycles.get(studentId)!,
    payment,
    next_payment: null,
  };
}

export async function markPaymentUnpaid(paymentId: string): Promise<StudentPayment> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("student_payments")
    .update({
      amount_paid: 0,
      paid_at: null,
      status: "pending",
    })
    .eq("id", paymentId)
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .single();

  if (error) throw new Error(error.message);

  const orgId = await resolveAdminOrgId();
  const students = await studentLookupMap(supabase, orgId);
  const mapped = mapPayment(data as PaymentDbRow, students.get(data.student_id));

  // recompute overdue if due date passed
  const status = computeStatus(mapped.amount_due, 0, mapped.due_date);
  if (status !== "pending") {
    await supabase
      .from("student_payments")
      .update({ status })
      .eq("id", paymentId);
    mapped.status = status;
  }

  await supabase.from("payment_events").insert({
    payment_id: paymentId,
    actor: "admin",
    action: "unpaid",
    amount: 0,
  });

  return mapped;
}

export async function markPaymentPaid(paymentId: string, amountPaid?: number) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: existing, error: fetchError } = await supabase
    .from("student_payments")
    .select("amount_due, organization_id")
    .eq("id", paymentId)
    .single();

  if (fetchError) {
    if (fetchError.message.toLowerCase().includes("organization_id")) {
      const retry = await supabase
        .from("student_payments")
        .select("amount_due")
        .eq("id", paymentId)
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return markPaymentPaidCore(supabase, paymentId, amountPaid, retry.data, null);
    }
    throw new Error(fetchError.message);
  }

  return markPaymentPaidCore(
    supabase,
    paymentId,
    amountPaid,
    existing,
    (existing as { organization_id?: string | null }).organization_id ?? null,
  );
}

async function markPaymentPaidCore(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  paymentId: string,
  amountPaid: number | undefined,
  existing: { amount_due: number },
  organizationId: string | null,
) {
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

  // audit log (optional table — ignore if migration not applied)
  await supabase.from("payment_events").insert({
    payment_id: paymentId,
    organization_id: organizationId,
    actor: "admin",
    action: status === "paid" ? "paid" : "partial",
    amount: paid,
  });

  const students = await studentLookupMap(supabase, organizationId);
  const mapped = mapPayment(data as PaymentDbRow, students.get(data.student_id));

  // Авто-цикл: после полной оплаты готовим счёт на след. месяц (N-е число + 1 мес)
  if (status === "paid" && data.student_id && data.period_month) {
    try {
      await ensureStudentPaymentForMonth(
        data.student_id,
        nextPeriodMonth(String(data.period_month).slice(0, 10)),
      );
    } catch {
      // next period optional if schema incomplete
    }
  }

  return mapped;
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

  const orgId = await resolveAdminOrgId();
  const end = nextDayIso(date);
  let query = supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .gte("paid_at", `${date}T00:00:00.000Z`)
    .lt("paid_at", `${end}T00:00:00.000Z`)
    .gt("amount_paid", 0)
    .order("paid_at", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);

  let { data, error } = await query;
  if (error?.message.toLowerCase().includes("organization_id")) {
    const fallback = await supabase
      .from("student_payments")
      .select(
        "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
      )
      .gte("paid_at", `${date}T00:00:00.000Z`)
      .lt("paid_at", `${end}T00:00:00.000Z`)
      .gt("amount_paid", 0)
      .order("paid_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  const students = await studentLookupMap(supabase, orgId);
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

export { formatMoney } from "@/lib/money";

/** Точечный статус оплаты одного ученика — без загрузки всего месяца. */
export async function getStudentPaymentStatus(
  studentId: string,
  periodMonth = currentPeriodMonth(),
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: payment, error } = await supabase
    .from("student_payments")
    .select(
      "id, student_id, amount_due, amount_paid, due_date, paid_at, status, period_month, note",
    )
    .eq("student_id", studentId)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (error && !error.message.includes("student_payments")) {
    throw new Error(error.message);
  }

  if (payment) {
    const amountDue = Number(payment.amount_due);
    const amountPaid = Number(payment.amount_paid);
    const status = computeStatus(amountDue, amountPaid, payment.due_date);
    return {
      amount_due: amountDue,
      amount_paid: amountPaid,
      due_date: payment.due_date,
      status,
      debt: Math.max(0, amountDue - amountPaid),
      has_invoice: true,
      period_month: payment.period_month,
    };
  }

  // Virtual invoice from student profile
  for (const select of [
    "monthly_fee, start_date, payment_due_day, status",
    "monthly_fee, is_active",
    "id",
  ]) {
    const { data: student, error: sErr } = await supabase
      .from("students")
      .select(select)
      .eq("id", studentId)
      .maybeSingle();

    if (sErr) {
      if (isSchemaish(sErr.message)) continue;
      throw new Error(sErr.message);
    }
    if (!student) return null;

    const row = student as {
      monthly_fee?: number | null;
      start_date?: string | null;
      payment_due_day?: number | null;
      status?: string | null;
      is_active?: boolean | null;
    };

    const active =
      row.status !== undefined
        ? row.status === "active"
        : (row.is_active ?? true);
    if (!active) return null;
    if (!studentStartedInPeriod(row.start_date ?? null, periodMonth)) return null;

    const fee = Number(row.monthly_fee ?? 500000);
    const dueDay = Number(row.payment_due_day ?? 10);
    const dueDate = dueDateFromPeriod(periodMonth, dueDay);
    const status = computeStatus(fee, 0, dueDate);
    return {
      amount_due: fee,
      amount_paid: 0,
      due_date: dueDate,
      status,
      debt: fee,
      has_invoice: false,
      period_month: periodMonth,
    };
  }

  return null;
}

function isSchemaish(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("column") || lower.includes("does not exist");
}