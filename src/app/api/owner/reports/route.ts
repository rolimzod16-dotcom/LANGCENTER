import { NextRequest, NextResponse } from "next/server";
import {
  getOwnerDailyReport,
  getOwnerReportList,
  getOwnerReportSummary,
  type PaymentListFilter,
} from "@/lib/owner-reports";
import { todayIso } from "@/lib/payments";

const FILTERS = new Set<PaymentListFilter>([
  "all",
  "paid",
  "debt",
  "overdue",
  "new",
]);

const SECTIONS = new Set(["received", "due"]);

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const view = params.get("view") ?? "day";
    const page = Number(params.get("page") ?? "1");
    const limit = Number(params.get("limit") ?? "50");
    const search = params.get("search") ?? "";

    if (view === "day") {
      const date = (params.get("date") ?? todayIso()).slice(0, 10);
      const sectionParam = params.get("section") ?? "received";
      const section = SECTIONS.has(sectionParam) ? sectionParam : "received";

      const report = await getOwnerDailyReport(
        date,
        section as "received" | "due",
        { page, limit, search },
      );
      return NextResponse.json(report);
    }

    const month = params.get("month") ?? undefined;
    const summaryOnly = params.get("summary_only") === "1";
    const filterParam = params.get("filter") ?? "all";
    const filter = FILTERS.has(filterParam as PaymentListFilter)
      ? (filterParam as PaymentListFilter)
      : "all";

    if (summaryOnly) {
      const report = await getOwnerReportSummary(month);
      return NextResponse.json(report);
    }

    const report = await getOwnerReportList(month, {
      page,
      limit,
      search,
      filter,
    });
    return NextResponse.json({ view: "month", ...report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка отчёта";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}