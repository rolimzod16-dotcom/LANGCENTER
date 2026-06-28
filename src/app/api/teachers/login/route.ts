import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth/session";
import { loginTeacher } from "@/lib/teachers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = String(body.teacher_code ?? "").trim();
    const password = String(body.password ?? "");

    if (!code || !password) {
      return NextResponse.json(
        { error: "Код и пароль обязательны" },
        { status: 400 },
      );
    }

    const teacher = await loginTeacher(code, password);
    if (!teacher) {
      return NextResponse.json(
        { error: "Неверный код или пароль" },
        { status: 401 },
      );
    }

    await setSession("teacher", teacher.id);
    return NextResponse.json({ teacher });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка входа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}