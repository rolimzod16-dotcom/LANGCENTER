export const ADMIN_COOKIE = "lc_admin";

export function isAdminAuthenticated(
  cookieValue: string | undefined,
): boolean {
  return cookieValue === "1";
}