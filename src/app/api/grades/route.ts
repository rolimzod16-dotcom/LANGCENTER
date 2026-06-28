import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { addGrade } from "@/lib/grades";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "Только для учителя" }, { status: 401 });
    }

    const body = await request.json();
    const grade = await addGrade({
      student_id: String(body.student_id),
      teacher_id: session.id,
      title: String(body.title ?? "Урок"),
      score: Number(body.score),
      max_score: body.max_score ? Number(body.max_score) : 100,
      comment: body.comment ? String(body.comment) : undefined,
    });

    return NextResponse.json({ grade }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}