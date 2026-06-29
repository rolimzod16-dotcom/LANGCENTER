import { NextRequest, NextResponse } from "next/server";
import { buildDayReportExcel, buildMonthReportExcel } from "@/lib/report-export";
import type { PaymentListFilter } from "@/lib/payments";
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
    const view = params.get("view") ?? "month";
    const search = params.get("search") ?? "";

    let content: string;
    let filename: string;

    if (view === "day") {
      const date = (params.get("date") ?? todayIso()).slice(0, 10);
      const sectionParam = params.get("section") ?? "received";
      const section = SECTIONS.has(sectionParam) ? sectionParam : "received";
      const result = await buildDayReportExcel({
        date,
        section: section as "received" | "due",
        search,
      });
      content = result.content;
      filename = result.filename;
    } else {
      const monthParam = params.get("month") ?? todayIso().slice(0, 7) + "-01";
      const periodMonth = monthParam.slice(0, 10);
      const filterParam = params.get("filter") ?? "all";
      const filter = FILTERS.has(filterParam as PaymentListFilter)
        ? (filterParam as PaymentListFilter)
        : "all";

      const result = await buildMonthReportExcel({
        periodMonth,
        filter,
        search,
      });
      content = result.content;
      filename = result.filename;
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка выгрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}