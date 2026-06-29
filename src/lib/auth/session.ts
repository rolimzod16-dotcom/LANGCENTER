import { cookies } from "next/headers";
import { authCookieOptions } from "@/lib/auth/cookie-options";

export type SessionRole = "student" | "teacher";

const COOKIE_ROLE = "lc_role";
const COOKIE_ID = "lc_id";

export async function setSession(role: SessionRole, id: string) {
  const jar = await cookies();
  const opts = authCookieOptions();
  jar.set(COOKIE_ROLE, role, opts);
  jar.set(COOKIE_ID, id, opts);
}

export async function clearSession() {
  const jar = await cookies();
  const opts = authCookieOptions(0);
  jar.set(COOKIE_ROLE, "", opts);
  jar.set(COOKIE_ID, "", opts);
}

export async function getSession(): Promise<{
  role: SessionRole;
  id: string;
} | null> {
  const jar = await cookies();
  const role = jar.get(COOKIE_ROLE)?.value as SessionRole | undefined;
  const id = jar.get(COOKIE_ID)?.value;
  if ((role !== "student" && role !== "teacher") || !id) return null;
  return { role, id };
}