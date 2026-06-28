import { NextRequest, NextResponse } from "next/server";
import {
  currentPeriodMonth,
  ensureStudentPaymentForMonth,
} from "@/lib/payments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId = String(body.student_id ?? "").trim();
    if (!studentId) {
      return NextResponse.json(
        { error: "student_id обязателен" },
        { status: 400 },
      );
    }

    const periodMonth = body.month
      ? String(body.month).slice(0, 10)
      : currentPeriodMonth();

    const payment = await ensureStudentPaymentForMonth(studentId, periodMonth);
    if (!payment) {
      return NextResponse.json(
        { error: "Ученик неактивен или ещё не начал занятия в этом месяце" },
        { status: 400 },
      );
    }

    return NextResponse.json({ payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}