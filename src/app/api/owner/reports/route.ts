import { NextRequest, NextResponse } from "next/server";
import { getOwnerReport } from "@/lib/owner-reports";

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month") ?? undefined;
    const report = await getOwnerReport(month);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка отчёта";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}