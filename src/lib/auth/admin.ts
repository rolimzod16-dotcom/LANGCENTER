import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { authCookieOptions, AUTH_MAX_AGE_SECONDS } from "@/lib/auth/cookie-options";
import {
  ADMIN_COOKIE,
  type AdminSessionPayload,
  verifyAdminCookie,
} from "@/lib/auth/admin-constants";
import { signToken, tokenExpirySeconds } from "@/lib/auth/signed-token";
import { DEFAULT_ORG_ID } from "@/lib/org-constants";

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

export async function setAdminSession(orgId: string | null = DEFAULT_ORG_ID) {
  const jar = await cookies();
  const payload: AdminSessionPayload = {
    role: "admin",
    org_id: orgId,
    exp: tokenExpirySeconds(AUTH_MAX_AGE_SECONDS),
    v: 1,
  };
  const token = await signToken(payload);
  jar.set(ADMIN_COOKIE, token, authCookieOptions());
  if (orgId) {
    jar.set("lc_org", orgId, authCookieOptions());
  }
}

export async function updateAdminOrg(orgId: string) {
  await setAdminSession(orgId);
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", authCookieOptions(0));
  jar.set("lc_org", "", authCookieOptions(0));
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  return verifyAdminCookie(jar.get(ADMIN_COOKIE)?.value);
}

export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Нет доступа. Только для администратора.");
  }
  return session;
}
