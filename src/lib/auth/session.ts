import { cookies } from "next/headers";
import { authCookieOptions, AUTH_MAX_AGE_SECONDS } from "@/lib/auth/cookie-options";
import { signToken, tokenExpirySeconds, verifyToken } from "@/lib/auth/signed-token";

export type SessionRole = "student" | "teacher";

const COOKIE_SESSION = "lc_session";
/** Legacy cookies — читаем при миграции, больше не пишем. */
const COOKIE_ROLE = "lc_role";
const COOKIE_ID = "lc_id";

export type AppSession = {
  role: SessionRole;
  id: string;
  org_id: string | null;
  exp: number;
  v: 1;
};

export async function setSession(
  role: SessionRole,
  id: string,
  orgId: string | null = null,
) {
  const jar = await cookies();
  const payload: AppSession = {
    role,
    id,
    org_id: orgId,
    exp: tokenExpirySeconds(AUTH_MAX_AGE_SECONDS),
    v: 1,
  };
  const token = await signToken(payload);
  jar.set(COOKIE_SESSION, token, authCookieOptions());
  // Clear legacy plain cookies
  jar.set(COOKIE_ROLE, "", authCookieOptions(0));
  jar.set(COOKIE_ID, "", authCookieOptions(0));
}

export async function clearSession() {
  const jar = await cookies();
  const opts = authCookieOptions(0);
  jar.set(COOKIE_SESSION, "", opts);
  jar.set(COOKIE_ROLE, "", opts);
  jar.set(COOKIE_ID, "", opts);
}

export async function getSession(): Promise<{
  role: SessionRole;
  id: string;
  org_id: string | null;
} | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSION)?.value;
  if (token) {
    const payload = await verifyToken<AppSession>(token);
    if (
      payload &&
      payload.v === 1 &&
      (payload.role === "student" || payload.role === "teacher") &&
      payload.id
    ) {
      return {
        role: payload.role,
        id: payload.id,
        org_id: payload.org_id ?? null,
      };
    }
  }

  // Legacy fallback (dev only): plain role+id cookies
  if (process.env.NODE_ENV !== "production") {
    const role = jar.get(COOKIE_ROLE)?.value as SessionRole | undefined;
    const id = jar.get(COOKIE_ID)?.value;
    if ((role === "student" || role === "teacher") && id) {
      return { role, id, org_id: null };
    }
  }

  return null;
}
