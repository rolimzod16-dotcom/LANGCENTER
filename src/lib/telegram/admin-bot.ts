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
import {
  acceptTrialApplication,
  formatApp,
  listPendingApplications,
  rejectTrialApplication,
} from "@/lib/telegram/applications";

function adminKeyboard() {
  return replyKeyboard([
    ["📋 Заявки", "✅ Ожидают"],
    ["👥 Ученики", "👨‍🏫 Учителя"],
    ["🌐 Сайт", "❓ Помощь"],
  ]);
}

async function isAdminChat(chatId: number): Promise<boolean> {
  const ids = await listAdminChatIds();
  return ids.includes(chatId);
}

async function handleAuth(chatId: number, password: string, username?: string) {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN!;
  if (!verifyAdminPassword(password)) {
    await sendMessage(token, chatId, "❌ Неверный пароль.");
    return;
  }
  const res = await linkAdminChat(chatId, username);
  if (!res.ok) {
    await sendMessage(
      token,
      chatId,
      `⚠️ ${res.error}\n\nchat_id: <code>${chatId}</code>`,
    );
    return;
  }
  await sendMessage(
    token,
    chatId,
    `✅ Чат привязан как админ/руководитель.\nID: <code>${chatId}</code>\n\nСюда приходят заявки на пробный урок и регистрации.`,
    { reply_markup: adminKeyboard() },
  );
}

async function listRecentStudents(limit = 10) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "БД не настроена";

  const { data, error } = await supabase
    .from("students")
    .select("full_name, student_code, phone, password_plain, notes, created_at")
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
      return `${i + 1}. <b>${name}</b>\n   🔑 <code>${code}</code> · 🔐 ${pass}\n   📞 ${phone}`;
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

async function sendPendingList(token: string, chatId: number) {
  try {
    const apps = await listPendingApplications(15);
    if (!apps.length) {
      await sendMessage(token, chatId, "Нет заявок в ожидании ✅");
      return;
    }
    for (const app of apps) {
      await sendMessage(
        token,
        chatId,
        `📝 <b>Заявка</b> · ${escapeHtml(app.status)}\n\n${formatApp(app)}`,
        {
          reply_markup: inlineKeyboard([
            [
              {
                text: "✅ Принять",
                callback_data: `lead:accept:${app.id}`,
              },
              {
                text: "❌ Отклонить",
                callback_data: `lead:reject:${app.id}`,
              },
            ],
          ]),
        },
      );
    }
  } catch (e) {
    await sendMessage(
      token,
      chatId,
      `Ошибка: ${e instanceof Error ? e.message : "unknown"}\nНужен supabase/TELEGRAM.sql`,
    );
  }
}

export async function handleAdminBotUpdate(update: TgUpdate): Promise<void> {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim();
  if (!token) return;

  // ---- callbacks: accept / reject ----
  if (update.callback_query) {
    const data = update.callback_query.data || "";
    const chatId = update.callback_query.message?.chat.id;
    const cbId = update.callback_query.id;
    if (!chatId) {
      await answerCallback(token, cbId);
      return;
    }

    if (!(await isAdminChat(chatId))) {
      await answerCallback(token, cbId, "Сначала /auth");
      await sendMessage(
        token,
        chatId,
        "Сначала привяжите чат: <code>/auth ПАРОЛЬ</code>",
      );
      return;
    }

    if (data === "lead:list") {
      await answerCallback(token, cbId);
      await sendPendingList(token, chatId);
      return;
    }

    if (data.startsWith("lead:accept:")) {
      const id = data.slice("lead:accept:".length);
      const res = await acceptTrialApplication(id, chatId);
      if (!res.ok) {
        await answerCallback(token, cbId, res.error);
        await sendMessage(token, chatId, `⚠️ ${res.error}`);
        return;
      }
      await answerCallback(token, cbId, "Принято");
      await sendMessage(
        token,
        chatId,
        [
          `✅ <b>Заявка принята</b>`,
          formatApp(res.app),
          ``,
          `🔑 Логин: <code>${escapeHtml(res.app.login_code || "")}</code>`,
          `🔐 Пароль: <code>${escapeHtml(res.app.plain_password || "")}</code>`,
          `Ученику отправлено в Telegram.`,
        ].join("\n"),
      );
      return;
    }

    if (data.startsWith("lead:reject:")) {
      const id = data.slice("lead:reject:".length);
      const res = await rejectTrialApplication(id, chatId);
      if (!res.ok) {
        await answerCallback(token, cbId, res.error);
        await sendMessage(token, chatId, `⚠️ ${res.error}`);
        return;
      }
      await answerCallback(token, cbId, "Отклонено");
      await sendMessage(token, chatId, "❌ Заявка отклонена. Ученику отправлено уведомление.");
      return;
    }

    await answerCallback(token, cbId);
    return;
  }

  const msg = update.message;
  if (!msg?.chat || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const base = appBaseUrl();
  const username = msg.from?.username;

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
        `<b>Lang Center — заявки и руководство</b>`,
        ``,
        linked
          ? `✅ Уведомления включены`
          : `⚠️ Привяжите: <code>/auth ПАРОЛЬ_АДМИНА</code>`,
        ``,
        `• Заявки на пробный урок → кнопки Принять / Отклонить`,
        `• Принять = создать ученика + логин/пароль в TG ученику`,
        `• «✅ Ожидают» — список pending`,
        `• «👥 Ученики» — логины и пароли`,
        ``,
        `Сайт: ${base}`,
      ].join("\n"),
      { reply_markup: adminKeyboard() },
    );
    return;
  }

  if (text === "/unlink") {
    await unlinkAdminChat(chatId);
    await sendMessage(token, chatId, "Чат отвязан.");
    return;
  }

  if (text === "/site" || text === "🌐 Сайт") {
    await sendMessage(token, chatId, `🌐 ${base}`, {
      reply_markup: inlineKeyboard([
        [{ text: "Сайт", url: base }],
        [{ text: "Админка", url: `${base}/admin` }],
        [{ text: "Ученики", url: `${base}/admin/students` }],
      ]),
    });
    return;
  }

  const needAuth =
    text === "/students" ||
    text === "📋 Заявки" ||
    text === "👥 Ученики" ||
    text === "/teachers" ||
    text === "👨‍🏫 Учителя" ||
    text === "✅ Ожидают" ||
    text === "/pending" ||
    text === "/leads";

  if (needAuth && !(await isAdminChat(chatId))) {
    await sendMessage(
      token,
      chatId,
      "Сначала: <code>/auth ПАРОЛЬ_АДМИНА</code>",
    );
    return;
  }

  if (
    text === "✅ Ожидают" ||
    text === "/pending" ||
    text === "/leads" ||
    text === "📋 Заявки"
  ) {
    await sendPendingList(token, chatId);
    return;
  }

  if (text === "/students" || text === "👥 Ученики") {
    const body = await listRecentStudents(15);
    await sendMessage(token, chatId, `<b>Ученики</b>\n\n${body}`);
    return;
  }

  if (text === "/teachers" || text === "👨‍🏫 Учителя") {
    const body = await listTeachers();
    await sendMessage(token, chatId, `<b>Учителя</b>\n\n${body}`);
    return;
  }

  await sendMessage(token, chatId, "«❓ Помощь» или /help", {
    reply_markup: adminKeyboard(),
  });
}
