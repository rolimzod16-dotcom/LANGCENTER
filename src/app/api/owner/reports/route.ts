import { NextRequest, NextResponse } from "next/server";
import {
  getOwnerReportList,
  getOwnerReportSummary,
  type PaymentListFilter,
} from "@/lib/owner-reports";

const FILTERS = new Set<PaymentListFilter>([
  "all",
  "paid",
  "debt",
  "overdue",
  "new",
]);

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const month = params.get("month") ?? undefined;
    const summaryOnly = params.get("summary_only") === "1";
    const page = Number(params.get("page") ?? "1");
    const limit = Number(params.get("limit") ?? "50");
    const search = params.get("search") ?? "";
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
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка отчёта";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}