import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { markAttendance, AttendanceStatus } from "@/lib/attendance";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "Только для учителя" }, { status: 401 });
    }

    const body = await request.json();
    const status = String(body.status ?? "present") as AttendanceStatus;

    const record = await markAttendance({
      student_id: String(body.student_id),
      teacher_id: session.id,
      status,
      note: body.note ? String(body.note) : undefined,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}