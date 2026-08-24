export function normalizeTelegramUsername(
  raw?: string | null,
): string | null {
  if (!raw) return null;
  const u = raw.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9_]{5,32}$/.test(u)) return null;
  return u;
}

export function telegramUrl(username?: string | null): string | null {
  const u = normalizeTelegramUsername(username);
  return u ? `https://t.me/${u}` : null;
}

export function telUrl(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : null;
}
