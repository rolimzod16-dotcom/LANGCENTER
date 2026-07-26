import { NextRequest, NextResponse } from "next/server";
import { handleTeacherBotUpdate } from "@/lib/telegram/teacher-bot";
import { type TgUpdate, verifyWebhookSecret } from "@/lib/telegram/api";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    bot: "teacher",
    configured: Boolean(process.env.TELEGRAM_TEACHER_BOT_TOKEN?.trim()),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyWebhookSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.TELEGRAM_TEACHER_BOT_TOKEN?.trim()) {
      return NextResponse.json({ ok: true, skipped: "no token" });
    }

    const update = (await request.json()) as TgUpdate;
    await handleTeacherBotUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("teacher telegram webhook", err);
    return NextResponse.json({ ok: true, error: true });
  }
}
