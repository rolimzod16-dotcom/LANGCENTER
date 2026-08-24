import { NextRequest, NextResponse } from "next/server";
import {
  markAttendance,
  markAttendanceBulk,
  type AttendanceStatus,
} from "@/lib/attendance";
import { getSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "Только для учителя" }, { status: 401 });
    }

    const body = await request.json();
    const status = String(body.status ?? "present") as AttendanceStatus;

    // Bulk: { student_ids: string[], status }
    if (Array.isArray(body.student_ids) && body.student_ids.length > 0) {
      const result = await markAttendanceBulk({
        teacher_id: session.id,
        student_ids: body.student_ids.map(String),
        status,
        organization_id: session.org_id,
      });
      return NextResponse.json({ bulk: true, ...result }, { status: 201 });
    }

    const record = await markAttendance({
      student_id: String(body.student_id),
      teacher_id: session.id,
      status,
      lesson_date: body.lesson_date ? String(body.lesson_date) : undefined,
      note: body.note ? String(body.note) : undefined,
      organization_id: session.org_id,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    const status = message.includes("не в ваших группах") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
