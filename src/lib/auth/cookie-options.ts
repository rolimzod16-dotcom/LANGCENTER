/** 30 дней — сессия переживает закрытие приложения / браузера */
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function authCookieOptions(maxAge = AUTH_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}