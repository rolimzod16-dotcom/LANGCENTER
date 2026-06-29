import {
  currentPeriodMonth,
  getDuePaymentsOnDate,
  getMonthDailyBreakdown,
  getOwnerPaymentsForMonth,
  listPaymentsReceivedOnDate,
  paginateOwnerPayments,
  summarizeDailyDue,
  summarizeDailyReceived,
  summarizeOwnerPayments,
  type DailyBreakdownRow,
  type DailyReportSection,
  type OwnerPaymentsQuery,
  type PaginatedOwnerPayments,
  type PaymentListFilter,
  type StudentPayment,
} from "@/lib/payments";
import {
  buildTeacherPayrollReport,
  type TeacherPayrollRow,
} from "@/lib/teacher-payroll";
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
    teacher_payroll_total: number;
    net_profit_after_payroll: number;
  };
  teacher_payroll: TeacherPayrollRow[];
};

export type OwnerReportList = OwnerReportSummary & {
  payments: StudentPayment[];
  daily_breakdown: DailyBreakdownRow[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
};

export type OwnerDailyReport = {
  view: "day";
  date: string;
  updated_at: string;
  summary: {
    received_total: number;
    received_count: number;
    due_today_total: number;
    due_today_count: number;
    due_today_unpaid_total: number;
    due_today_unpaid_count: number;
    teacher_payroll_total: number;
    net_profit_after_payroll: number;
  };
  section: DailyReportSection;
  teacher_payroll: TeacherPayrollRow[];
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

async function monthPayroll(payments: StudentPayment[]) {
  const paymentSummary = summarizeOwnerPayments(payments);
  const payroll = await buildTeacherPayrollReport(
    payments,
    "course",
    paymentSummary.total_income,
  );
  return {
    teacher_payroll_total: payroll.total_payroll,
    net_profit_after_payroll: payroll.net_after_payroll,
    teacher_payroll: payroll.teachers,
  };
}

export async function getOwnerReportSummary(
  periodMonth = currentPeriodMonth(),
): Promise<OwnerReportSummary> {
  const [counts, payments] = await Promise.all([
    studentCounts(),
    getOwnerPaymentsForMonth(periodMonth),
  ]);
  const paymentSummary = summarizeOwnerPayments(payments);
  const payroll = await monthPayroll(payments);

  return {
    period_month: periodMonth,
    updated_at: new Date().toISOString(),
    summary: {
      ...counts,
      ...paymentSummary,
      teacher_payroll_total: payroll.teacher_payroll_total,
      net_profit_after_payroll: payroll.net_profit_after_payroll,
    },
    teacher_payroll: payroll.teacher_payroll,
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
  const payroll = await monthPayroll(payments);
  const page = paginateOwnerPayments(payments, options);

  return {
    period_month: periodMonth,
    updated_at: new Date().toISOString(),
    summary: {
      ...counts,
      ...paymentSummary,
      teacher_payroll_total: payroll.teacher_payroll_total,
      net_profit_after_payroll: payroll.net_profit_after_payroll,
    },
    teacher_payroll: payroll.teacher_payroll,
    payments: page.items,
    daily_breakdown: getMonthDailyBreakdown(payments),
    pagination: {
      total: page.total,
      page: page.page,
      limit: page.limit,
      total_pages: page.total_pages,
    },
  };
}

export async function getOwnerDailyReport(
  date: string,
  section: DailyReportSection = "received",
  options: Omit<OwnerPaymentsQuery, "periodMonth" | "filter"> = {},
): Promise<OwnerDailyReport> {
  const [received, due] = await Promise.all([
    listPaymentsReceivedOnDate(date),
    getDuePaymentsOnDate(date),
  ]);

  const source = section === "received" ? received : due;
  const page = paginateOwnerPayments(source, options);
  const receivedSummary = summarizeDailyReceived(received);
  const payroll = await buildTeacherPayrollReport(
    source,
    section === "received" ? "paid" : "course",
    section === "received" ? receivedSummary.received_total : 0,
  );

  return {
    view: "day",
    date,
    updated_at: new Date().toISOString(),
    summary: {
      ...receivedSummary,
      ...summarizeDailyDue(due),
      teacher_payroll_total: payroll.total_payroll,
      net_profit_after_payroll: payroll.net_after_payroll,
    },
    section,
    teacher_payroll: payroll.teachers,
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