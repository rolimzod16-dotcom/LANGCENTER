import { NextRequest, NextResponse } from "next/server";
import {
  appBaseUrl,
  setMyCommands,
  setWebhook,
} from "@/lib/telegram/api";

/**
 * POST /api/telegram/setup
 * Header: x-setup-secret: same as TELEGRAM_WEBHOOK_SECRET or ADMIN_PASSWORD
 * Registers webhooks for both bots.
 */
export async function POST(request: NextRequest) {
  const expected =
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim();
  const got =
    request.headers.get("x-setup-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || got !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = appBaseUrl();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const adminToken = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim();
  const studentToken = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
  const teacherToken = process.env.TELEGRAM_TEACHER_BOT_TOKEN?.trim();

  const results: Record<string, unknown> = { base };

  if (adminToken) {
    const url = `${base}/api/telegram/admin/webhook`;
    results.admin = {
      webhook: await setWebhook(adminToken, url, secret),
      commands: await setMyCommands(adminToken, [
        { command: "start", description: "Старт / помощь" },
        { command: "auth", description: "Привязать чат: /auth пароль" },
        { command: "pending", description: "Заявки на пробный урок" },
        { command: "find", description: "Найти ученика: /find Али" },
        { command: "assign", description: "Назначить учителя ученику" },
        { command: "newteacher", description: "Создать учителя" },
        { command: "students", description: "Последние ученики" },
        { command: "teachers", description: "Учителя" },
        { command: "site", description: "Ссылки на сайт" },
        { command: "unlink", description: "Отвязать чат" },
      ]),
      url,
    };
  } else {
    results.admin = { skipped: "TELEGRAM_ADMIN_BOT_TOKEN not set" };
  }

  if (studentToken) {
    const url = `${base}/api/telegram/student/webhook`;
    results.student = {
      webhook: await setWebhook(studentToken, url, secret),
      commands: await setMyCommands(studentToken, [
        { command: "start", description: "Старт / помощь" },
        { command: "trial", description: "Заявка на пробный урок" },
        { command: "register", description: "Регистрация (логин+пароль)" },
        { command: "login", description: "/login ЛОГИН пароль" },
        { command: "grades", description: "Оценки" },
        { command: "attendance", description: "Посещаемость" },
        { command: "pay", description: "Оплата" },
        { command: "cancel", description: "Отменить диалог" },
        { command: "help", description: "Помощь" },
      ]),
      url,
    };
  } else {
    results.student = { skipped: "TELEGRAM_STUDENT_BOT_TOKEN not set" };
  }

  if (teacherToken) {
    const url = `${base}/api/telegram/teacher/webhook`;
    results.teacher = {
      webhook: await setWebhook(teacherToken, url, secret),
      commands: await setMyCommands(teacherToken, [
        { command: "start", description: "Старт / помощь" },
        { command: "login", description: "/login TCH-… пароль" },
        { command: "students", description: "Мои ученики" },
        { command: "attendance", description: "Посещаемость сегодня" },
        { command: "grade", description: "Поставить оценку" },
        { command: "cancel", description: "Отменить" },
        { command: "help", description: "Помощь" },
      ]),
      url,
    };
  } else {
    results.teacher = { skipped: "TELEGRAM_TEACHER_BOT_TOKEN not set" };
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST with header x-setup-secret to register webhooks",
    admin_configured: Boolean(process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim()),
    student_configured: Boolean(process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim()),
    teacher_configured: Boolean(process.env.TELEGRAM_TEACHER_BOT_TOKEN?.trim()),
  });
}
