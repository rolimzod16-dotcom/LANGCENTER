import { NextRequest, NextResponse } from "next/server";
import {
  currentPeriodMonth,
  setStudentCashStatus,
} from "@/lib/payments";

/**
 * Офлайн-касса по ученику:
 * POST { student_id, action: "paid" | "unpaid", month?: "YYYY-MM-01" }
 *
 * paid  → текущий месяц оплачен, автоматически создаётся счёт на след. месяц
 * unpaid → сброс оплаты текущего месяца
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId = String(body.student_id ?? "").trim();
    const action = String(body.action ?? "").trim() as "paid" | "unpaid";
    const periodMonth = body.month
      ? String(body.month).slice(0, 10)
      : currentPeriodMonth();

    if (!studentId) {
      return NextResponse.json(
        { error: "student_id обязателен" },
        { status: 400 },
      );
    }
    if (action !== "paid" && action !== "unpaid") {
      return NextResponse.json(
        { error: 'action: "paid" или "unpaid"' },
        { status: 400 },
      );
    }

    const result = await setStudentCashStatus(studentId, action, periodMonth);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
