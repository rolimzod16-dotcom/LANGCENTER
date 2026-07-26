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
  findStudentByChatId,
  linkStudentTelegram,
  studentCabinetSummary,
} from "@/lib/telegram/student-link";
import {
  clearTgSession,
  getTgSession,
  patchTgSession,
  setTgSession,
} from "@/lib/telegram/sessions";
import {
  createTrialApplication,
  notifyAdminsTrialApplication,
} from "@/lib/telegram/applications";
import {
  isValidStudentLogin,
  normalizeStudentLogin,
  registerPublicStudent,
} from "@/lib/students";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const COURSES = [
  "English (общий)",
  "English · IELTS",
  "Китайский",
  "Русский",
  "Türkçe",
  "Пока не знаю",
];

const TIMES = [
  "09:00",
  "10:30",
  "12:00",
  "14:00",
  "16:00",
  "17:30",
  "18:30",
  "19:30",
];

function studentKeyboard() {
  return replyKeyboard([
    ["📝 Пробный урок", "✍️ Регистрация"],
    ["📊 Оценки", "✅ Посещаемость"],
    ["💳 Оплата", "👨‍🏫 Учителя"],
    ["🔗 Войти", "🌐 Кабинет"],
    ["❌ Отмена", "❓ Помощь"],
  ]);
}

function parseLoginCommand(
  text: string,
): { login: string; password: string } | null {
  const m =
    text.match(/^\/login(?:@\w+)?\s+(\S+)\s+(.+)$/i) ||
    text.match(/^войти\s+(\S+)\s+(.+)$/i);
  if (!m) return null;
  return { login: m[1]!.trim(), password: m[2]!.trim() };
}

function parseDate(text: string): string | null {
  const t = text.trim();
  // DD.MM.YYYY or DD.MM or YYYY-MM-DD
  let m = t.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return t;
  if (/^сегодня$/i.test(t)) return new Date().toISOString().slice(0, 10);
  if (/^завтра$/i.test(t)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

async function sendHelp(token: string, chatId: number) {
  const base = appBaseUrl();
  await sendMessage(
    token,
    chatId,
    [
      `<b>Lang Center — бот ученика</b>`,
      ``,
      `📝 <b>Пробный урок</b> — заявка на день и время (админ примет/отклонит)`,
      `✍️ <b>Регистрация</b> — сразу создать логин и пароль в Telegram`,
      `🔗 <b>Войти</b> — привязать уже существующий кабинет`,
      ``,
      `После привязки: оценки, посещаемость, оплата, учителя`,
      ``,
      `Сайт: ${base}/register`,
    ].join("\n"),
    { reply_markup: studentKeyboard() },
  );
}

async function requireLinked(token: string, chatId: number) {
  const student = await findStudentByChatId(chatId);
  if (!student) {
    await sendMessage(
      token,
      chatId,
      "Кабинет не привязан.\n\n«✍️ Регистрация» — новый аккаунт\n«📝 Пробный урок» — заявка\nили <code>/login ЛОГИН пароль</code>",
      { reply_markup: studentKeyboard() },
    );
    return null;
  }
  return student;
}

async function startTrial(token: string, chatId: number) {
  await setTgSession(chatId, "student", "trial_name", {});
  await sendMessage(
    token,
    chatId,
    "📝 <b>Заявка на пробный урок</b>\n\nКак вас зовут? (Имя и фамилия)\n\nОтмена: «❌ Отмена»",
  );
}

async function startRegister(token: string, chatId: number) {
  await setTgSession(chatId, "student", "reg_name", {});
  await sendMessage(
    token,
    chatId,
    "✍️ <b>Регистрация ученика</b>\n\nИмя и фамилия?\n\nОтмена: «❌ Отмена»",
  );
}

async function handleTrialState(
  token: string,
  chatId: number,
  text: string,
  username?: string,
) {
  const session = await getTgSession(chatId, "student");
  const state = session.state;
  const data = session.data;

  if (state === "trial_name") {
    if (text.length < 2) {
      await sendMessage(token, chatId, "Введите имя и фамилию.");
      return;
    }
    await patchTgSession(chatId, "student", "trial_phone", {
      full_name: text,
    });
    await sendMessage(
      token,
      chatId,
      "📞 Телефон? (или «-» если не хотите указывать)",
    );
    return;
  }

  if (state === "trial_phone") {
    const phone = text === "-" ? "" : text;
    await patchTgSession(chatId, "student", "trial_course", { phone });
    const rows = COURSES.map((c, i) => [
      { text: c, callback_data: `trial_course:${i}` },
    ]);
    await sendMessage(token, chatId, "📚 Выберите курс:", {
      reply_markup: inlineKeyboard(rows),
    });
    return;
  }

  if (state === "trial_date") {
    const date = parseDate(text);
    if (!date) {
      await sendMessage(
        token,
        chatId,
        "Дата в формате <code>ДД.ММ.ГГГГ</code> или «завтра» / «сегодня»",
      );
      return;
    }
    await patchTgSession(chatId, "student", "trial_time", {
      preferred_date: date,
    });
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < TIMES.length; i += 2) {
      rows.push(
        TIMES.slice(i, i + 2).map((t, j) => ({
          text: t,
          callback_data: `trial_time:${i + j}`,
        })),
      );
    }
    await sendMessage(token, chatId, "🕐 Выберите время:", {
      reply_markup: inlineKeyboard(rows),
    });
    return;
  }

  // free-text time fallback
  if (state === "trial_time") {
    await finishTrial(token, chatId, text, username);
  }
}

async function finishTrial(
  token: string,
  chatId: number,
  timeText: string,
  username?: string,
) {
  const session = await getTgSession(chatId, "student");
  const d = session.data;
  try {
    const app = await createTrialApplication({
      telegram_chat_id: chatId,
      telegram_username: username,
      full_name: String(d.full_name || "Ученик"),
      phone: d.phone ? String(d.phone) : undefined,
      course: d.course ? String(d.course) : undefined,
      preferred_date: d.preferred_date ? String(d.preferred_date) : undefined,
      preferred_time: timeText,
    });
    await clearTgSession(chatId, "student");
    await notifyAdminsTrialApplication(app);
    await sendMessage(
      token,
      chatId,
      [
        `✅ <b>Заявка отправлена!</b>`,
        ``,
        `👤 ${escapeHtml(String(d.full_name))}`,
        d.course ? `📚 ${escapeHtml(String(d.course))}` : "",
        `📅 ${escapeHtml(String(d.preferred_date || "—"))} · 🕐 ${escapeHtml(timeText)}`,
        ``,
        `Администратор примет или отклонит — мы напишем сюда.`,
      ]
        .filter(Boolean)
        .join("\n"),
      { reply_markup: studentKeyboard() },
    );
  } catch (e) {
    await sendMessage(
      token,
      chatId,
      `❌ Ошибка: ${e instanceof Error ? e.message : "неизвестно"}\n\nЗапустите supabase/TELEGRAM.sql если ещё не запускали.`,
    );
  }
}

async function handleRegState(token: string, chatId: number, text: string) {
  const session = await getTgSession(chatId, "student");
  const state = session.state;
  const data = session.data;

  if (state === "reg_name") {
    if (text.length < 2) {
      await sendMessage(token, chatId, "Введите имя и фамилию.");
      return;
    }
    await patchTgSession(chatId, "student", "reg_phone", { full_name: text });
    await sendMessage(token, chatId, "📞 Телефон? (или «-»)");
    return;
  }

  if (state === "reg_phone") {
    await patchTgSession(chatId, "student", "reg_login", {
      phone: text === "-" ? "" : text,
    });
    await sendMessage(
      token,
      chatId,
      "🔑 Придумайте <b>логин</b> (латиница, 3–32 символа)\nПример: <code>ALI_2026</code>",
    );
    return;
  }

  if (state === "reg_login") {
    const login = normalizeStudentLogin(text);
    if (!isValidStudentLogin(login)) {
      await sendMessage(
        token,
        chatId,
        "Логин: 3–32 символа — латиница, цифры, . _ @ -",
      );
      return;
    }
    await patchTgSession(chatId, "student", "reg_password", { login });
    await sendMessage(
      token,
      chatId,
      "🔐 Придумайте <b>пароль</b> (минимум 6 символов)",
    );
    return;
  }

  if (state === "reg_password") {
    if (text.length < 6) {
      await sendMessage(token, chatId, "Пароль не короче 6 символов.");
      return;
    }
    await patchTgSession(chatId, "student", "reg_password2", {
      password: text,
    });
    await sendMessage(token, chatId, "Повторите пароль:");
    return;
  }

  if (state === "reg_password2") {
    if (text !== String(data.password || "")) {
      await sendMessage(token, chatId, "Пароли не совпадают. Введите пароль ещё раз:");
      await setTgSession(chatId, "student", "reg_password", {
        full_name: data.full_name,
        phone: data.phone,
        login: data.login,
      });
      return;
    }

    const full = String(data.full_name || "").trim();
    const parts = full.split(/\s+/);
    const last_name = parts[0] || "Ученик";
    const first_name = parts.slice(1).join(" ") || parts[0] || "Новый";

    try {
      const student = await registerPublicStudent({
        first_name,
        last_name,
        phone: data.phone ? String(data.phone) : undefined,
        login: String(data.login),
        password: String(data.password),
        preferred_course: "Регистрация через Telegram",
      });

      const supabase = getSupabaseServerClient();
      if (supabase) {
        await supabase
          .from("students")
          .update({ telegram_chat_id: chatId })
          .eq("id", student.id);
      }

      await clearTgSession(chatId, "student");
      const base = appBaseUrl();
      await sendMessage(
        token,
        chatId,
        [
          `✅ <b>Регистрация успешна!</b>`,
          ``,
          `👤 ${escapeHtml(full)}`,
          `🔑 Логин: <code>${escapeHtml(student.student_code)}</code>`,
          `🔐 Пароль: <code>${escapeHtml(student.plain_password)}</code>`,
          ``,
          `Кабинет привязан к этому Telegram.`,
          `Сайт: ${base}/student/login`,
        ].join("\n"),
        { reply_markup: studentKeyboard() },
      );
    } catch (e) {
      await sendMessage(
        token,
        chatId,
        `❌ ${e instanceof Error ? e.message : "Ошибка регистрации"}`,
      );
    }
  }
}

export async function handleStudentBotUpdate(update: TgUpdate): Promise<void> {
  const token = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
  if (!token) return;

  // callbacks (course / time pickers)
  if (update.callback_query) {
    const data = update.callback_query.data || "";
    const chatId = update.callback_query.message?.chat.id;
    const username = update.callback_query.from?.username;
    await answerCallback(token, update.callback_query.id);
    if (!chatId) return;

    if (data.startsWith("trial_course:")) {
      const idx = Number(data.split(":")[1]);
      const course = COURSES[idx] || COURSES[0]!;
      await patchTgSession(chatId, "student", "trial_date", { course });
      await sendMessage(
        token,
        chatId,
        `Курс: <b>${escapeHtml(course)}</b>\n\n📅 На какую дату? (ДД.ММ.ГГГГ / завтра / сегодня)`,
      );
      return;
    }

    if (data.startsWith("trial_time:")) {
      const idx = Number(data.split(":")[1]);
      const time = TIMES[idx] || "18:30";
      await finishTrial(token, chatId, time, username);
      return;
    }

    if (data === "help") {
      await sendHelp(token, chatId);
    }
    return;
  }

  const msg = update.message;
  if (!msg?.chat || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const base = appBaseUrl();
  const username = msg.from?.username;

  // cancel
  if (
    text === "❌ Отмена" ||
    text === "/cancel" ||
    /^отмена$/i.test(text)
  ) {
    await clearTgSession(chatId, "student");
    await sendMessage(token, chatId, "Отменено.", {
      reply_markup: studentKeyboard(),
    });
    return;
  }

  // active multi-step?
  const session = await getTgSession(chatId, "student");
  if (session.state.startsWith("trial_")) {
    await handleTrialState(token, chatId, text, username);
    return;
  }
  if (session.state.startsWith("reg_")) {
    await handleRegState(token, chatId, text);
    return;
  }

  if (text === "/start" || text === "/help" || text === "❓ Помощь") {
    await sendHelp(token, chatId);
    return;
  }

  if (
    text === "📝 Пробный урок" ||
    text === "/trial" ||
    text === "/zayavka"
  ) {
    await startTrial(token, chatId);
    return;
  }

  if (
    text === "✍️ Регистрация" ||
    text === "✍️ Записаться" ||
    text === "/register"
  ) {
    await startRegister(token, chatId);
    return;
  }

  if (text === "🔗 Войти" || text === "/link") {
    await sendMessage(
      token,
      chatId,
      "Пришлите:\n<code>/login ЛОГИН пароль</code>",
    );
    return;
  }

  const loginCmd = parseLoginCommand(text);
  if (loginCmd) {
    const res = await linkStudentTelegram(
      loginCmd.login,
      loginCmd.password,
      chatId,
    );
    if (!res.ok) {
      await sendMessage(token, chatId, `❌ ${res.error}`);
      return;
    }
    await sendMessage(
      token,
      chatId,
      `✅ Привязано!\n\n👤 ${escapeHtml(res.full_name)}\n🔑 <code>${escapeHtml(res.student_code)}</code>`,
      { reply_markup: studentKeyboard() },
    );
    return;
  }

  if (text === "🌐 Кабинет" || text === "/app") {
    await sendMessage(token, chatId, "Личный кабинет:", {
      reply_markup: inlineKeyboard([
        [{ text: "🎓 Кабинет", url: `${base}/student/login` }],
        [{ text: "📱 Приложение", url: `${base}/app` }],
      ]),
    });
    return;
  }

  if (
    text === "📊 Оценки" ||
    text === "/grades" ||
    text === "✅ Посещаемость" ||
    text === "/attendance" ||
    text === "💳 Оплата" ||
    text === "/pay" ||
    text === "👨‍🏫 Учителя" ||
    text === "/teachers"
  ) {
    const student = await requireLinked(token, chatId);
    if (!student) return;
    const summary = await studentCabinetSummary(student.id);

    if (text.includes("Оценк") || text === "/grades") {
      const grades = summary.grades as Array<{
        title?: string;
        score?: number;
        max_score?: number;
      }>;
      if (!grades?.length) {
        await sendMessage(token, chatId, "Пока нет оценок.");
        return;
      }
      const body = grades
        .slice(0, 15)
        .map(
          (g, i) =>
            `${i + 1}. <b>${escapeHtml(String(g.title ?? "Оценка"))}</b> — ${g.score ?? "—"}/${g.max_score ?? 100}`,
        )
        .join("\n");
      await sendMessage(token, chatId, `<b>Оценки</b>\n\n${body}`);
      return;
    }

    if (text.includes("Посещаем") || text === "/attendance") {
      const att = summary.attendance as Array<{
        status?: string;
        lesson_date?: string;
      }>;
      if (!att?.length) {
        await sendMessage(token, chatId, "Пока нет отметок.");
        return;
      }
      const label: Record<string, string> = {
        present: "✅ был",
        late: "⏰ опоздал",
        absent: "❌ не был",
        excused: "📝 уваж.",
      };
      const body = att
        .slice(0, 15)
        .map(
          (a, i) =>
            `${i + 1}. ${a.lesson_date?.slice(0, 10) ?? "—"} — ${label[a.status ?? ""] ?? a.status}`,
        )
        .join("\n");
      await sendMessage(token, chatId, `<b>Посещаемость</b>\n\n${body}`);
      return;
    }

    if (text.includes("Оплат") || text === "/pay") {
      const p = summary.payment as {
        amount_due?: number;
        amount_paid?: number;
        debt?: number;
        status?: string;
        due_date?: string;
        has_invoice?: boolean;
      } | null;
      if (!p || p.has_invoice === false) {
        await sendMessage(token, chatId, "Счёт пока не сформирован.");
        return;
      }
      await sendMessage(
        token,
        chatId,
        [
          `<b>Оплата</b>`,
          `Статус: <b>${escapeHtml(p.status ?? "—")}</b>`,
          `К оплате: ${p.amount_due ?? "—"}`,
          `Оплачено: ${p.amount_paid ?? 0}`,
          `Долг: ${p.debt ?? "—"}`,
          p.due_date ? `Срок: ${p.due_date}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return;
    }

    if (text.includes("Учител") || text === "/teachers") {
      const teachers = summary.teachers as Array<{ full_name?: string }>;
      if (!teachers?.length) {
        await sendMessage(token, chatId, "Учитель ещё не назначен.");
        return;
      }
      const body = teachers
        .map((t, i) => `${i + 1}. <b>${escapeHtml(t.full_name || "—")}</b>`)
        .join("\n");
      await sendMessage(token, chatId, `<b>Ваши учителя</b>\n\n${body}`);
      return;
    }
  }

  await sendMessage(
    token,
    chatId,
    "Не понял. «📝 Пробный урок» · «✍️ Регистрация» · «❓ Помощь»",
    { reply_markup: studentKeyboard() },
  );
}
