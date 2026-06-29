import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { authCookieOptions } from "@/lib/auth/cookie-options";
import { ADMIN_COOKIE } from "@/lib/auth/admin-constants";

export { ADMIN_COOKIE } from "@/lib/auth/admin-constants";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  return safeEqual(password, expected);
}

export async function setAdminSession() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "1", authCookieOptions());
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", authCookieOptions(0));
}

