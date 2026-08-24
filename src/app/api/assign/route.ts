import { NextRequest, NextResponse } from "next/server";
import { assignStudentToTeacher } from "@/lib/groups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId = String(body.student_id ?? "");
    const teacherId = String(body.teacher_id ?? "");
    const groupId = body.group_id ? String(body.group_id) : undefined;

    if (!studentId || !teacherId) {
      return NextResponse.json(
        { error: "Выбери ученика и учителя" },
        { status: 400 },
      );
    }

    const result = await assignStudentToTeacher(studentId, teacherId, groupId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
