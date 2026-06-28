import {
  currentPeriodMonth,
  getOwnerPaymentsForMonth,
  paginateOwnerPayments,
  summarizeOwnerPayments,
  type OwnerPaymentsQuery,
  type PaginatedOwnerPayments,
  type PaymentListFilter,
  type StudentPayment,
} from "@/lib/payments";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type OwnerReportSummary = {
  period_month: string;
  updated_at: string;
  summary: {
    total_students: number;
    active_students: number;
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
};

export type OwnerReportList = OwnerReportSummary & {
  payments: StudentPayment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
};

async function studentCounts() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { count: totalStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true });

  const { count: activeStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return {
    total_students: totalStudents ?? 0,
    active_students: activeStudents ?? 0,
  };
}

export async function getOwnerReportSummary(
  periodMonth = currentPeriodMonth(),
): Promise<OwnerReportSummary> {
  const [counts, payments] = await Promise.all([
    studentCounts(),
    getOwnerPaymentsForMonth(periodMonth),
  ]);

  return {
    period_month: periodMonth,
    updated_at: new Date().toISOString(),
    summary: {
      ...counts,
      ...summarizeOwnerPayments(payments),
    },
  };
}

export async function getOwnerReportList(
  periodMonth = currentPeriodMonth(),
  options: Omit<OwnerPaymentsQuery, "periodMonth"> = {},
): Promise<OwnerReportList> {
  const [counts, payments] = await Promise.all([
    studentCounts(),
    getOwnerPaymentsForMonth(periodMonth),
  ]);
  const paymentSummary = summarizeOwnerPayments(payments);
  const page = paginateOwnerPayments(payments, options);

  return {
    period_month: periodMonth,
    updated_at: new Date().toISOString(),
    summary: {
      ...counts,
      ...paymentSummary,
    },
    payments: page.items,
    pagination: {
      total: page.total,
      page: page.page,
      limit: page.limit,
      total_pages: page.total_pages,
    },
  };
}

/** @deprecated Use getOwnerReportSummary or getOwnerReportList */
export async function getOwnerReport(periodMonth = currentPeriodMonth()) {
  return getOwnerReportList(periodMonth, { page: 1, limit: 100 });
}

export type { PaymentListFilter, PaginatedOwnerPayments };