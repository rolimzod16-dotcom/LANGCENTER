/**
 * HMAC-signed tokens (Web Crypto) — работают и в Edge middleware, и в Node.
 */

function getSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "lang-center-dev-insecure-secret"
  );
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

function utf8ToArrayBuffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8ToArrayBuffer(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const body = bytesToBase64Url(utf8ToArrayBuffer(JSON.stringify(payload)));
  const key = await importHmacKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, utf8ToArrayBuffer(body));
  return `${body}.${bytesToBase64Url(sig)}`;
}

export async function verifyToken<T extends Record<string, unknown>>(
  token: string | undefined | null,
): Promise<T | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const key = await importHmacKey(getSecret());
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToArrayBuffer(sig),
      utf8ToArrayBuffer(body),
    );
    if (!ok) return null;

    const json = new TextDecoder().decode(base64UrlToArrayBuffer(body));
    const payload = JSON.parse(json) as T & { exp?: number };
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function tokenExpirySeconds(maxAgeSeconds: number): number {
  return Math.floor(Date.now() / 1000) + maxAgeSeconds;
}
