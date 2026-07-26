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
import {
  assignTeacherToStudent,
  formatStudentCard,
  getStudentBrief,
  getTeacherBrief,
  listActiveTeachers,
  searchStudents,
  studentResultKeyboard,
  teacherPickKeyboard,
} from "@/lib/telegram/admin-assign";
import {
  clearTgSession,
  getTgSession,
  setTgSession,
} from "@/lib/telegram/sessions";
import { getTeacherNamesByStudentIds } from "@/lib/groups";

function adminKeyboard() {
  return replyKeyboard([
    ["📋 Заявки", "✅ Ожидают"],
    ["🔍 Найти ученика", "🔗 Назначить"],
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
    `✅ Чат привязан как админ/руководитель.\nID: <code>${chatId}</code>\n\nЗаявки, поиск учеников, назначение учителя — здесь.`,
    { reply_markup: adminKeyboard() },
  );
}

async function listRecentStudents(limit = 10) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "БД не настроена";

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, student_code, phone, password_plain, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return `Ошибка: ${error.message}`;
  if (!data?.length) return "Пока нет учеников.";

  const names = await getTeacherNamesByStudentIds(data.map((s) => s.id));

  return data
    .map((s, i) => {
      const name = escapeHtml(s.full_name || "—");
      const code = escapeHtml(s.student_code || "");
      const pass = s.password_plain
        ? `<code>${escapeHtml(s.password_plain)}</code>`
        : "—";
      const phone = s.phone ? escapeHtml(s.phone) : "—";
      const tch = names.get(s.id);
      return `${i + 1}. <b>${name}</b>\n   🔑 <code>${code}</code> · 🔐 ${pass}\n   📞 ${phone}${tch ? `\n   👨‍🏫 ${escapeHtml(tch)}` : "\n   👨‍🏫 не назначен"}`;
    })
    .join("\n\n");
}

async function listTeachersText() {
  const teachers = await listActiveTeachers();
  if (!teachers.length) return "Учителей нет.";
  return teachers
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
      `Ошибка: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }
}

/** Показать выбор учителя для ученика */
async function promptAssignTeacher(
  token: string,
  chatId: number,
  studentId: string,
) {
  const student = await getStudentBrief(studentId);
  if (!student) {
    await sendMessage(token, chatId, "Ученик не найден.");
    return;
  }
  const teachers = await listActiveTeachers();
  if (!teachers.length) {
    await sendMessage(
      token,
      chatId,
      "Нет активных учителей. Создайте учителя в админке сайта.",
    );
    return;
  }

  // student id в session (callback учителя не вмещает оба uuid)
  await setTgSession(chatId, "admin", "assign_pick_teacher", {
    student_id: studentId,
  });

  const names = await getTeacherNamesByStudentIds([studentId]);
  await sendMessage(
    token,
    chatId,
    [
      `🔗 <b>Назначить учителя</b>`,
      ``,
      formatStudentCard(student, names.get(studentId)),
      ``,
      `Выберите учителя:`,
    ].join("\n"),
    { reply_markup: teacherPickKeyboard(teachers) },
  );
}

async function doSearchAndShow(token: string, chatId: number, query: string) {
  const hits = await searchStudents(query, 10);
  if (!hits.length) {
    await sendMessage(
      token,
      chatId,
      `Никого не нашёл по «${escapeHtml(query)}».\nПопробуйте логин, фамилию или телефон.`,
      { reply_markup: adminKeyboard() },
    );
    return;
  }

  const names = await getTeacherNamesByStudentIds(hits.map((h) => h.id));

  await sendMessage(
    token,
    chatId,
    `🔍 Найдено: <b>${hits.length}</b>\nЗапрос: <code>${escapeHtml(query)}</code>`,
  );

  for (const s of hits) {
    await sendMessage(
      token,
      chatId,
      formatStudentCard(s, names.get(s.id)),
      { reply_markup: studentResultKeyboard(s.id) },
    );
  }
}

export async function handleAdminBotUpdate(update: TgUpdate): Promise<void> {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim();
  if (!token) return;

  // ---- callbacks ----
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
        "Сначала: <code>/auth ПАРОЛЬ</code>",
      );
      return;
    }

    if (data === "lead:list") {
      await answerCallback(token, cbId);
      await sendPendingList(token, chatId);
      return;
    }

    if (data === "asg:cancel") {
      await clearTgSession(chatId, "admin");
      await answerCallback(token, cbId, "Отменено");
      await sendMessage(token, chatId, "Отменено.", {
        reply_markup: adminKeyboard(),
      });
      return;
    }

    // asg:s:{studentId} — начать выбор учителя
    if (data.startsWith("asg:s:")) {
      const studentId = data.slice("asg:s:".length);
      await answerCallback(token, cbId);
      await promptAssignTeacher(token, chatId, studentId);
      return;
    }

    // asg:t:{teacherId} — закрепить (student из session)
    if (data.startsWith("asg:t:")) {
      const teacherId = data.slice("asg:t:".length);
      const session = await getTgSession(chatId, "admin");
      const studentId = String(session.data.student_id || "");
      if (!studentId || session.state !== "assign_pick_teacher") {
        await answerCallback(token, cbId, "Сначала выберите ученика");
        await sendMessage(
          token,
          chatId,
          "Сначала найдите ученика: «🔍 Найти ученика»",
        );
        return;
      }

      const result = await assignTeacherToStudent(studentId, teacherId);
      if (!result.ok) {
        await answerCallback(token, cbId, "Ошибка");
        await sendMessage(token, chatId, `⚠️ ${result.error}`);
        return;
      }

      await clearTgSession(chatId, "admin");
      const student = await getStudentBrief(studentId);
      const teacher = await getTeacherBrief(teacherId);
      await answerCallback(token, cbId, "Назначен");
      await sendMessage(
        token,
        chatId,
        [
          `✅ <b>Учитель закреплён</b>`,
          ``,
          `👤 ${escapeHtml(student?.full_name || "—")} · <code>${escapeHtml(student?.student_code || "")}</code>`,
          `👨‍🏫 ${escapeHtml(teacher?.full_name || "—")} · <code>${escapeHtml(teacher?.teacher_code || "")}</code>`,
        ].join("\n"),
        { reply_markup: adminKeyboard() },
      );
      return;
    }

    if (data.startsWith("lead:accept:")) {
      const id = data.slice("lead:accept:".length);
      const res = await acceptTrialApplication(id, chatId);
      if (!res.ok) {
        await answerCallback(token, cbId, res.error.slice(0, 30));
        await sendMessage(
          token,
          chatId,
          res.error.includes("не найдена")
            ? `⚠️ ${res.error}\n\nСтарые кнопки из тестов не работают. Создайте новую заявку в student-боте или «✅ Ожидают».`
            : `⚠️ ${res.error}`,
        );
        return;
      }
      await answerCallback(token, cbId, "Принято");
      const studentId = res.app.student_id;
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
          ``,
          `Теперь назначьте учителя 👇`,
        ].join("\n"),
        studentId
          ? {
              reply_markup: inlineKeyboard([
                [
                  {
                    text: "👨‍🏫 Назначить учителя",
                    callback_data: `asg:s:${studentId}`,
                  },
                ],
                [
                  {
                    text: "🔍 Найти другого ученика",
                    callback_data: "asg:search",
                  },
                ],
              ]),
            }
          : undefined,
      );
      return;
    }

    if (data.startsWith("lead:reject:")) {
      const id = data.slice("lead:reject:".length);
      const res = await rejectTrialApplication(id, chatId);
      if (!res.ok) {
        await answerCallback(token, cbId, res.error.slice(0, 30));
        await sendMessage(
          token,
          chatId,
          res.error.includes("не найдена")
            ? `⚠️ ${res.error}\n(старая/удалённая заявка)`
            : `⚠️ ${res.error}`,
        );
        return;
      }
      await answerCallback(token, cbId, "Отклонено");
      await sendMessage(
        token,
        chatId,
        "❌ Заявка отклонена. Ученику отправлено уведомление.",
      );
      return;
    }

    if (data === "asg:search") {
      await answerCallback(token, cbId);
      await setTgSession(chatId, "admin", "search_student", {});
      await sendMessage(
        token,
        chatId,
        "🔍 Введите <b>имя</b>, <b>логин</b> или <b>телефон</b> ученика:",
      );
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

  // multi-step: search
  if (await isAdminChat(chatId)) {
    const session = await getTgSession(chatId, "admin");
    if (session.state === "search_student") {
      if (text === "❌ Отмена" || text === "/cancel") {
        await clearTgSession(chatId, "admin");
        await sendMessage(token, chatId, "Отменено.", {
          reply_markup: adminKeyboard(),
        });
        return;
      }
      await clearTgSession(chatId, "admin");
      await doSearchAndShow(token, chatId, text);
      return;
    }
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
        `📝 Заявки → Принять / Отклонить`,
        `👨‍🏫 После принятия → «Назначить учителя»`,
        `🔍 Быстрый поиск ученика → назначить учителя`,
        `🔗 /assign — то же`,
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
    text === "/leads" ||
    text === "🔍 Найти ученика" ||
    text === "/find" ||
    text === "/search" ||
    text === "🔗 Назначить" ||
    text === "/assign" ||
    text.startsWith("/find ") ||
    text.startsWith("/search ");

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

  // search shortcuts
  if (
    text === "🔍 Найти ученика" ||
    text === "/find" ||
    text === "/search" ||
    text === "🔗 Назначить" ||
    text === "/assign"
  ) {
    await setTgSession(chatId, "admin", "search_student", {});
    await sendMessage(
      token,
      chatId,
      "🔍 Введите <b>имя</b>, <b>логин</b> (STU…) или <b>телефон</b>:\n\nПример: <code>Али</code> · <code>STU01</code> · <code>99290</code>\nОтмена: /cancel",
    );
    return;
  }

  if (text.startsWith("/find ") || text.startsWith("/search ")) {
    const q = text.replace(/^\/(find|search)\s+/i, "").trim();
    if (q) {
      await doSearchAndShow(token, chatId, q);
      return;
    }
  }

  // If looks like a search query (short free text while admin) — optional quick search
  // Only when not a known command — handled below as help

  if (text === "/students" || text === "👥 Ученики") {
    const body = await listRecentStudents(15);
    await sendMessage(
      token,
      chatId,
      `<b>Последние ученики</b>\n\n${body}\n\n🔍 Найти: «🔍 Найти ученика»`,
    );
    return;
  }

  if (text === "/teachers" || text === "👨‍🏫 Учителя") {
    const body = await listTeachersText();
    await sendMessage(token, chatId, `<b>Учителя</b>\n\n${body}`);
    return;
  }

  // Quick search: admin sends bare query (letters/digits, not slash command)
  if (
    (await isAdminChat(chatId)) &&
    text.length >= 2 &&
    !text.startsWith("/") &&
    !["❌ Отмена"].includes(text)
  ) {
    // avoid intercepting pure emoji keyboard presses already handled
    const keyboardLabels = [
      "📋 Заявки",
      "✅ Ожидают",
      "🔍 Найти ученика",
      "🔗 Назначить",
      "👥 Ученики",
      "👨‍🏫 Учителя",
      "🌐 Сайт",
      "❓ Помощь",
    ];
    if (!keyboardLabels.includes(text)) {
      await doSearchAndShow(token, chatId, text);
      return;
    }
  }

  await sendMessage(token, chatId, "«❓ Помощь» или /help", {
    reply_markup: adminKeyboard(),
  });
}
