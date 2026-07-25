import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth/session";
import {
  isValidStudentLogin,
  normalizeStudentLogin,
  registerPublicStudent,
} from "@/lib/students";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : "";
    const login = normalizeStudentLogin(String(body.login ?? body.student_code ?? ""));
    const password = String(body.password ?? "");
    const preferredCourse = body.preferred_course
      ? String(body.preferred_course).trim()
      : "";
    const preferredSchedule = body.preferred_schedule
      ? String(body.preferred_schedule).trim()
      : "";

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Имя и фамилия обязательны" },
        { status: 400 },
      );
    }

    if (!login || !isValidStudentLogin(login)) {
      return NextResponse.json(
        {
          error:
            "Логин: 3–32 символа — латиница, цифры, точка, _ @ или -",
        },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль не короче 6 символов" },
        { status: 400 },
      );
    }

    if (password.length > 72) {
      return NextResponse.json(
        { error: "Пароль слишком длинный" },
        { status: 400 },
      );
    }

    const student = await registerPublicStudent({
      first_name: firstName,
      last_name: lastName,
      phone: phone || undefined,
      login,
      password,
      preferred_course: preferredCourse || undefined,
      preferred_schedule: preferredSchedule || undefined,
    });

    await setSession("student", student.id, student.organization_id ?? null);

    return NextResponse.json(
      {
        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          student_code: student.student_code,
          phone: student.phone,
        },
        credentials: {
          login: student.student_code,
          password: student.plain_password,
        },
        message:
          "Регистрация успешна. Войдите с этим логином и паролем. Администрация тоже видит ваши данные для помощи.",
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ошибка регистрации";
    const status =
      message.includes("занят") || message.includes("Логин") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
