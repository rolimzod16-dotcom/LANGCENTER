import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth/admin-constants";
import { authCookieOptions, AUTH_MAX_AGE_SECONDS } from "@/lib/auth/cookie-options";
import {
  isAdminPasswordConfigured,
  verifyAdminPassword,
} from "@/lib/auth/password";
import { signToken, tokenExpirySeconds } from "@/lib/auth/signed-token";
import { DEFAULT_ORG_ID } from "@/lib/org-constants";

export const runtime = "nodejs";

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

    const token = await signToken({
      role: "admin",
      org_id: DEFAULT_ORG_ID,
      exp: tokenExpirySeconds(AUTH_MAX_AGE_SECONDS),
      v: 1,
    });
    const res = NextResponse.json({ ok: true });
    const opts = authCookieOptions();
    res.cookies.set(ADMIN_COOKIE, token, opts);
    res.cookies.set("lc_org", DEFAULT_ORG_ID, opts);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("admin login failed", err);
    return NextResponse.json(
      { error: "Ошибка входа", detail: message },
      { status: 500 },
    );
  }
}