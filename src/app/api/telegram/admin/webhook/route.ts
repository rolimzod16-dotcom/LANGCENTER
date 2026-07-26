import { NextRequest, NextResponse } from "next/server";
import { handleAdminBotUpdate } from "@/lib/telegram/admin-bot";
import { type TgUpdate, verifyWebhookSecret } from "@/lib/telegram/api";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    bot: "admin",
    configured: Boolean(process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim()),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyWebhookSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim()) {
      return NextResponse.json({ ok: true, skipped: "no token" });
    }

    const update = (await request.json()) as TgUpdate;
    await handleAdminBotUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin telegram webhook", err);
    // Always 200 so Telegram doesn't storm retries
    return NextResponse.json({ ok: true, error: true });
  }
}
