import { NextRequest, NextResponse } from "next/server";
import {
  isAdminPasswordConfigured,
  setAdminSession,
  verifyAdminPassword,
} from "@/lib/auth/admin";

export async function POST(request: NextRequest) {
  try {
    if (!isAdminPasswordConfigured()) {
      return NextResponse.json(
        {
          error:
            "Админ-пароль не настроен. Добавьте ADMIN_PASSWORD в переменные окружения.",
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const password = String(body.password ?? "");

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: "Неверный пароль администратора" },
        { status: 401 },
      );
    }

    await setAdminSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка входа" }, { status: 500 });
  }
}