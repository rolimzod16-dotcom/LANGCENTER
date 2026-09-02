/** Minimal Telegram Bot API client (no extra deps). */

export type TgUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TgChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  date?: number;
};

export type TgCallbackQuery = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
};

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

export function appBaseUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://langcenter-tillojon.vercel.app";
  return raw.replace(/\/$/, "");
}

export async function tgApi<T = unknown>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: T;
  };
  if (!data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed`);
  }
  return data.result as T;
}

export async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  extra?: {
    parse_mode?: "HTML" | "Markdown";
    reply_markup?: unknown;
    disable_web_page_preview?: boolean;
  },
) {
  try {
    return await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: extra?.parse_mode ?? "HTML",
      reply_markup: extra?.reply_markup,
      disable_web_page_preview: extra?.disable_web_page_preview ?? true,
    });
  } catch (err) {
    // Не валим весь webhook: чат мог удалить бота / тестовый id
    console.error("sendMessage failed", chatId, err);
    return null;
  }
}

export async function answerCallback(
  token: string,
  callbackQueryId: string,
  text?: string,
) {
  try {
    return await tgApi(token, "answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    });
  } catch (err) {
    console.error("answerCallback failed", err);
    return null;
  }
}

export function inlineKeyboard(rows: InlineButton[][]) {
  return { inline_keyboard: rows };
}

export function replyKeyboard(rows: string[][]) {
  return {
    keyboard: rows.map((r) => r.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

export async function setWebhook(
  token: string,
  url: string,
  secret?: string,
) {
  return tgApi(token, "setWebhook", {
    url,
    secret_token: secret || undefined,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function setMyCommands(
  token: string,
  commands: Array<{ command: string; description: string }>,
) {
  return tgApi(token, "setMyCommands", { commands });
}

export function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  return header === secret;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
