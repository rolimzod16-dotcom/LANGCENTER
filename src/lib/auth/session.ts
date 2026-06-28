import { cookies } from "next/headers";

export type SessionRole = "student" | "teacher";

const COOKIE_ROLE = "lc_role";
const COOKIE_ID = "lc_id";

export async function setSession(role: SessionRole, id: string) {
  const jar = await cookies();
  jar.set(COOKIE_ROLE, role, { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set(COOKIE_ID, id, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_ROLE);
  jar.delete(COOKIE_ID);
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