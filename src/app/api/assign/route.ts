import { NextRequest, NextResponse } from "next/server";
import { assignStudentToTeacher } from "@/lib/groups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId = String(body.student_id ?? "");
    const teacherId = String(body.teacher_id ?? "");
    if (!studentId || !teacherId) {
      return NextResponse.json(
        { error: "Выбери ученика и учителя" },
        { status: 400 },
      );
    }

    const result = await assignStudentToTeacher(studentId, teacherId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}