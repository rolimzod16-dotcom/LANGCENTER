import { NextRequest, NextResponse } from "next/server";
import { currentPeriodMonth, generateMonthlyPayments } from "@/lib/payments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const periodMonth =
      typeof body.month === "string" ? body.month : currentPeriodMonth();
    const result = await generateMonthlyPayments(periodMonth);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}