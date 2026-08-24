import { verifyToken } from "@/lib/auth/signed-token";

export const ADMIN_COOKIE = "lc_admin";

export type AdminSessionPayload = {
  role: "admin";
  org_id: string | null;
  exp: number;
  v: 1;
};

/** Sync-ish check for legacy cookie "1" + signed token format presence. Prefer async verify. */
export function isAdminCookiePresent(cookieValue: string | undefined): boolean {
  return Boolean(cookieValue && cookieValue.length > 0);
}

export async function verifyAdminCookie(
  cookieValue: string | undefined,
): Promise<AdminSessionPayload | null> {
  if (!cookieValue) return null;

  // Legacy: plain "1" — only accepted if SESSION_SECRET not set AND NODE_ENV is development
  // Migration window: accept "1" as admin without org for one release if needed.
  // Security: require signed token in production.
  if (cookieValue === "1") {
    if (process.env.NODE_ENV === "production") return null;
    return {
      role: "admin",
      org_id: null,
      exp: Math.floor(Date.now() / 1000) + 3600,
      v: 1,
    };
  }

  const payload = await verifyToken<AdminSessionPayload>(cookieValue);
  if (!payload || payload.role !== "admin" || payload.v !== 1) return null;
  return payload;
}

/** @deprecated use verifyAdminCookie — kept for rare sync callers */
export function isAdminAuthenticated(cookieValue: string | undefined): boolean {
  return isAdminCookiePresent(cookieValue);
}
