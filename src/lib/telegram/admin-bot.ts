import {
  type TgUpdate,
  answerCallback,
  appBaseUrl,
  escapeHtml,
  inlineKeyboard,
  replyKeyboard,
  sendMessage,
} from "@/lib/telegram/api";
import {
  linkAdminChat,
  listAdminChatIds,
  unlinkAdminChat,
} from "@/lib/telegram/admin-store";
import { verifyAdminPassword } from "@/lib/auth/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function adminKeyboard() {
  return replyKeyboard([
    ["📋 Заявки", "👥 Ученики"],
    ["👨‍🏫 Учителя", "🌐 Сайт"],
    ["❓ Помощь"],
  ]);
}

async function isAdminChat(chatId: number): Promise<boolean> {
  const ids = await listAdminChatIds();
  return ids.includes(chatId);
}

async function handleAuth(chatId: number, password: string, username?: string) {
  if (!verifyAdminPassword(password)) {
    await sendMessage(
      process.env.TELEGRAM_ADMIN_BOT_TOKEN!,
      chatId,
      "❌ Неверный пароль.",
    );
    return;
  }
  const res = await linkAdminChat(chatId, username);
  if (!res.ok) {
    await sendMessage(
      process.env.TELEGRAM_ADMIN_BOT_TOKEN!,
      chatId,
      `⚠️ ${res.error}\n\nПока можно добавить chat_id <code>${chatId}</code> в TELEGRAM_ADMIN_CHAT_IDS на Vercel.`,
    );
    return;
  }
  await sendMessage(
    process.env.TELEGRAM_ADMIN_BOT_TOKEN!,
    chatId,
    `✅ Чат привязан как админ/руководитель.\nID: <code>${chatId}</code>\n\nТеперь сюда будут приходить новые заявки с сайта.`,
    { reply_markup: adminKeyboard() },
  );
}

async function listRecentStudents(limit = 10) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "БД не настроена";

  const { data, error } = await supabase
    .from("students")
    .select("full_name, student_code, phone, password_plain, created_at, notes")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return `Ошибка: ${error.message}`;
  if (!data?.length) return "Пока нет учеников.";

  return data
    .map((s, i) => {
      const name = escapeHtml(s.full_name || "—");
      const code = escapeHtml(s.student_code || "");
      const pass = s.password_plain
        ? `<code>${escapeHtml(s.password_plain)}</code>`
        : "—";
      const phone = s.phone ? escapeHtml(s.phone) : "—";
      const notes = s.notes ? `\n   ${escapeHtml(String(s.notes).slice(0, 80))}` : "";
      return `${i + 1}. <b>${name}</b>\n   🔑 <code>${code}</code> · 🔐 ${pass}\n   📞 ${phone}${notes}`;
    })
    .join("\n\n");
}

async function listTeachers() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "БД не настроена";

  const { data, error } = await supabase
    .from("teachers")
    .select("full_name, teacher_code, status")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return `Ошибка: ${error.message}`;
  if (!data?.length) return "Учителей нет.";

  return data
    .map(
      (t, i) =>
        `${i + 1}. <b>${escapeHtml(t.full_name || "—")}</b> · <code>${escapeHtml(t.teacher_code || "")}</code>`,
    )
    .join("\n");
}

export async function handleAdminBotUpdate(update: TgUpdate): Promise<void> {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim();
  if (!token) return;

  if (update.callback_query) {
    await answerCallback(token, update.callback_query.id);
    return;
  }

  const msg = update.message;
  if (!msg?.chat || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const base = appBaseUrl();
  const username = msg.from?.username;

  // /auth <password>
  if (text.startsWith("/auth")) {
    const password = text.replace(/^\/auth(@\w+)?\s*/i, "").trim();
    if (!password) {
      await sendMessage(
        token,
        chatId,
        "Использование: <code>/auth ваш_админ_пароль</code>",
      );
      return;
    }
    await handleAuth(chatId, password, username);
    return;
  }

  if (text === "/start" || text === "/help" || text === "❓ Помощь") {
    const linked = await isAdminChat(chatId);
    await sendMessage(
      token,
      chatId,
      [
        `<b>Lang Center — бот заявок и руководства</b>`,
        ``,
        linked
          ? `✅ Этот чат получает уведомления о новых учениках.`
          : `⚠️ Чат ещё не привязан.\nОтправьте: <code>/auth ПАРОЛЬ_АДМИНА</code>`,
        ``,
        `Команды:`,
        `/auth пароль — привязать чат`,
        `/students — последние ученики (логин+пароль)`,
        `/teachers — учителя`,
        `/unlink — отключить уведомления`,
        `/site — сайт центра`,
        ``,
        `Сайт: ${base}`,
        `Админка: ${base}/admin`,
      ].join("\n"),
      { reply_markup: adminKeyboard() },
    );
    return;
  }

  if (text === "/unlink") {
    await unlinkAdminChat(chatId);
    await sendMessage(token, chatId, "Чат отвязан от уведомлений (если был в БД).");
    return;
  }

  if (text === "/site" || text === "🌐 Сайт") {
    await sendMessage(token, chatId, `🌐 ${base}`, {
      reply_markup: inlineKeyboard([
        [{ text: "Открыть сайт", url: base }],
        [{ text: "Админка", url: `${base}/admin` }],
        [{ text: "Заявки (ученики)", url: `${base}/admin/students` }],
      ]),
    });
    return;
  }

  const needAuth =
    text === "/students" ||
    text === "📋 Заявки" ||
    text === "👥 Ученики" ||
    text === "/teachers" ||
    text === "👨‍🏫 Учителя";

  if (needAuth && !(await isAdminChat(chatId))) {
    await sendMessage(
      token,
      chatId,
      "Сначала привяжите чат: <code>/auth ПАРОЛЬ_АДМИНА</code>",
    );
    return;
  }

  if (text === "/students" || text === "📋 Заявки" || text === "👥 Ученики") {
    const body = await listRecentStudents(12);
    await sendMessage(
      token,
      chatId,
      `<b>Последние ученики</b>\n\n${body}`,
    );
    return;
  }

  if (text === "/teachers" || text === "👨‍🏫 Учителя") {
    const body = await listTeachers();
    await sendMessage(token, chatId, `<b>Учителя</b>\n\n${body}`);
    return;
  }

  await sendMessage(
    token,
    chatId,
    "Не понял команду. Нажмите «❓ Помощь» или /help",
    { reply_markup: adminKeyboard() },
  );
}
