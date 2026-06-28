import { NextRequest, NextResponse } from "next/server";
import { assignStudentToTeacher, getTeacherForStudent } from "@/lib/groups";
import { createStudent, listStudents } from "@/lib/students";

export async function GET() {
  try {
    const students = await listStudents();
    const enriched = await Promise.all(
      students.map(async (s) => {
        const teacher = await getTeacherForStudent(s.id);
        return { ...s, teacher_name: teacher?.teacher_name ?? null };
      }),
    );
    return NextResponse.json({ students: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const teacherId = String(body.teacher_id ?? "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Имя и фамилия обязательны" },
        { status: 400 },
      );
    }

    if (!teacherId) {
      return NextResponse.json(
        { error: "Сначала выбери учителя" },
        { status: 400 },
      );
    }

    const monthlyFee = body.monthly_fee ? Number(body.monthly_fee) : undefined;

    const student = await createStudent({
      first_name: firstName,
      last_name: lastName,
      email: body.email ? String(body.email) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      monthly_fee: monthlyFee,
    });

    await assignStudentToTeacher(student.id, teacherId);

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка создания";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}