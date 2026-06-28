import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth/session";
import { loginStudent } from "@/lib/students";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = String(body.student_code ?? "").trim();
    const password = String(body.password ?? "");

    if (!code || !password) {
      return NextResponse.json(
        { error: "Код и пароль обязательны" },
        { status: 400 },
      );
    }

    const student = await loginStudent(code, password);
    if (!student) {
      return NextResponse.json(
        { error: "Неверный код или пароль" },
        { status: 401 },
      );
    }

    await setSession("student", student.id);
    return NextResponse.json({ student });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка входа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}