import {
  currentPeriodMonth,
  getOwnerPaymentsForMonth,
  type StudentPayment,
} from "@/lib/payments";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type OwnerReport = {
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
  };
  payments: StudentPayment[];
};

export async function getOwnerReport(
  periodMonth = currentPeriodMonth(),
): Promise<OwnerReport> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { count: totalStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true });

  const { count: activeStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const payments = await getOwnerPaymentsForMonth(periodMonth);

  const totalIncome = payments.reduce((s, p) => s + p.amount_paid, 0);
  const totalExpected = payments.reduce((s, p) => s + p.amount_due, 0);
  const totalDebt = payments.reduce(
    (s, p) => s + Math.max(0, p.amount_due - p.amount_paid),
    0,
  );

  const paidCount = payments.filter((p) => p.status === "paid").length;
  const debtCount = payments.filter(
    (p) => p.status !== "paid" && p.amount_paid < p.amount_due,
  ).length;
  const overdueCount = payments.filter((p) => p.status === "overdue").length;
  const newCount = payments.filter((p) => !p.has_invoice).length;

  return {
    period_month: periodMonth,
    updated_at: new Date().toISOString(),
    summary: {
      total_students: totalStudents ?? 0,
      active_students: activeStudents ?? 0,
      total_income: totalIncome,
      total_expected: totalExpected,
      total_debt: totalDebt,
      profit: totalIncome,
      paid_count: paidCount,
      debt_count: debtCount,
      overdue_count: overdueCount,
      new_count: newCount,
    },
    payments,
  };
}