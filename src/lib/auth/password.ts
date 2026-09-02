export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  let out = 0;
  for (let i = 0; i < expected.length; i++) {
    out |= password.charCodeAt(i)! ^ expected.charCodeAt(i)!;
  }
  return out === 0;
}
