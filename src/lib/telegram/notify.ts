import { appBaseUrl, escapeHtml, sendMessage } from "@/lib/telegram/api";
import { listAdminChatIds } from "@/lib/telegram/admin-store";

export type NewLeadPayload = {
  full_name: string;
  login: string;
  password: string;
  phone?: string | null;
  course?: string;
  schedule?: string;
  student_id?: string;
};

/** Уведомление админам/руководителю о новой заявке с сайта. */
export async function notifyAdminsNewLead(lead: NewLeadPayload): Promise<void> {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim();
  if (!token) return;

  const chats = await listAdminChatIds();
  if (!chats.length) return;

  const base = appBaseUrl();
  const lines = [
    `🆕 <b>Новая заявка / регистрация</b>`,
    ``,
    `👤 ${escapeHtml(lead.full_name)}`,
    `🔑 Логин: <code>${escapeHtml(lead.login)}</code>`,
    `🔐 Пароль: <code>${escapeHtml(lead.password)}</code>`,
  ];
  if (lead.phone) lines.push(`📞 ${escapeHtml(lead.phone)}`);
  if (lead.course) lines.push(`📚 Курс: ${escapeHtml(lead.course)}`);
  if (lead.schedule) lines.push(`🕐 ${escapeHtml(lead.schedule)}`);
  lines.push(``, `Админка: ${base}/admin/students`);

  const text = lines.join("\n");

  await Promise.allSettled(
    chats.map((chatId) =>
      sendMessage(token, chatId, text).catch((err) => {
        console.error("notify admin chat", chatId, err);
      }),
    ),
  );
}

/** Короткое уведомление ученику в его бот (если привязан chat_id). */
export async function notifyStudent(
  chatId: number,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
  if (!token) return;
  await sendMessage(token, chatId, text).catch((err) => {
    console.error("notify student", chatId, err);
  });
}
