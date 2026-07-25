/** Только цифры: +998 90 123-45-67 → 998901234567 */
export function phoneDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/** Похоже на поиск по телефону (есть 4+ цифр) */
export function looksLikePhoneSearch(value: string): boolean {
  const digits = phoneDigits(value);
  return digits.length >= 4;
}

/** Нормализация для сохранения / сравнения */
export function normalizePhoneInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  return trimmed;
}
