import { NextResponse } from "next/server";
import { getOwnerReportSummary } from "@/lib/owner-reports";
import {
  currentPeriodMonth,
  listPaymentsReceivedOnDate,
  summarizeDailyReceived,
  todayIso,
} from "@/lib/payments";
import { listTeachers } from "@/lib/teachers";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const periodMonth = currentPeriodMonth();
    const today = todayIso();

    const [report, teachers, todayPayments, studentCount] = await Promise.all([
      getOwnerReportSummary(periodMonth),
      listTeachers(),
      listPaymentsReceivedOnDate(today),
      countActiveStudents(),
    ]);

    const todayStats = summarizeDailyReceived(todayPayments);
    const activeTeachers = teachers.filter((t) => t.status === "active").length;

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      teachers_total: teachers.length,
      teachers_active: activeTeachers,
      students_active: studentCount,
      today_income: todayStats.received_total,
      today_payments: todayStats.received_count,
      month_income: report.summary.total_income,
      month_expected: report.summary.total_expected,
      month_debt: report.summary.total_debt,
      month_debtors: report.summary.debt_count,
      month_payroll: report.summary.teacher_payroll_total,
      month_net_profit: report.summary.net_profit_after_payroll,
      month_new_without_invoice: report.summary.new_count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка дашборда";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function countActiveStudents() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 0;

  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return count ?? 0;
}