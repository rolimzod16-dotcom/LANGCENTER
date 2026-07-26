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

function studentKeyboard() {
  return replyKeyboard([
    ["📊 Оценки", "✅ Посещаемость"],
    ["💳 Оплата", "👨‍🏫 Учителя"],
    ["✍️ Записаться", "🔗 Войти"],
    ["🌐 Кабинет", "❓ Помощь"],
  ]);
}

function parseLoginCommand(text: string): { login: string; password: string } | null {
  // /login CODE password...  OR  войти CODE password
  const m =
    text.match(/^\/login(?:@\w+)?\s+(\S+)\s+(.+)$/i) ||
    text.match(/^войти\s+(\S+)\s+(.+)$/i);
  if (!m) return null;
  return { login: m[1]!.trim(), password: m[2]!.trim() };
}

async function sendHelp(token: string, chatId: number) {
  const base = appBaseUrl();
  await sendMessage(
    token,
    chatId,
    [
      `<b>Lang Center — бот ученика</b>`,
      ``,
      `Здесь можно:`,
      `• записаться на курс`,
      `• привязать кабинет`,
      `• смотреть оценки, посещаемость, оплату`,
      ``,
      `<b>Привязка кабинета</b>`,
      `Отправьте одной строкой:`,
      `<code>/login ВАШ_ЛОГИН ваш_пароль</code>`,
      ``,
      `Пример: <code>/login ALI_2026 secret12</code>`,
      ``,
      `Сайт: ${base}`,
      `Запись: ${base}/register`,
      `Кабинет: ${base}/student/login`,
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
      "Кабинет не привязан.\n\nОтправьте:\n<code>/login ЛОГИН пароль</code>\n\nИли нажмите «✍️ Записаться», если ещё нет аккаунта.",
      { reply_markup: studentKeyboard() },
    );
    return null;
  }
  return student;
}

export async function handleStudentBotUpdate(update: TgUpdate): Promise<void> {
  const token = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
  if (!token) return;

  if (update.callback_query) {
    const data = update.callback_query.data || "";
    const chatId = update.callback_query.message?.chat.id;
    await answerCallback(token, update.callback_query.id);
    if (!chatId) return;
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

  if (text === "/start" || text === "/help" || text === "❓ Помощь") {
    await sendHelp(token, chatId);
    return;
  }

  if (text === "✍️ Записаться" || text === "/register") {
    await sendMessage(
      token,
      chatId,
      "Заполните форму на сайте — логин и пароль придумаете сами. Потом вернитесь и привяжите кабинет командой /login",
      {
        reply_markup: inlineKeyboard([
          [{ text: "✍️ Открыть запись", url: `${base}/register` }],
          [{ text: "📱 Приложение", url: `${base}/app` }],
        ]),
      },
    );
    return;
  }

  if (text === "🔗 Войти" || text === "/link") {
    await sendMessage(
      token,
      chatId,
      "Пришлите одной строкой:\n<code>/login ЛОГИН пароль</code>",
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
      `✅ Привязано!\n\n👤 ${escapeHtml(res.full_name)}\n🔑 <code>${escapeHtml(res.student_code)}</code>\n\nТеперь кнопки «Оценки», «Посещаемость», «Оплата» работают.`,
      { reply_markup: studentKeyboard() },
    );
    return;
  }

  if (text === "🌐 Кабинет" || text === "/app") {
    await sendMessage(token, chatId, "Личный кабинет в браузере:", {
      reply_markup: inlineKeyboard([
        [{ text: "🎓 Кабинет ученика", url: `${base}/student/login` }],
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
        graded_at?: string;
      }>;
      if (!grades?.length) {
        await sendMessage(token, chatId, "Пока нет оценок.");
        return;
      }
      const body = grades
        .slice(0, 15)
        .map((g, i) => {
          const title = escapeHtml(String(g.title ?? "Оценка"));
          const score = g.score ?? "—";
          const max = g.max_score ?? 100;
          return `${i + 1}. <b>${title}</b> — ${score}/${max}`;
        })
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
        await sendMessage(token, chatId, "Пока нет отметок посещаемости.");
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
        .map((a, i) => {
          const d = a.lesson_date?.slice(0, 10) ?? "—";
          const st = label[a.status ?? ""] ?? a.status ?? "—";
          return `${i + 1}. ${d} — ${st}`;
        })
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
        await sendMessage(
          token,
          chatId,
          "Счёт за месяц пока не сформирован. Уточните в центре.",
        );
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
      const teachers = summary.teachers as Array<{
        full_name?: string;
        teacher_code?: string;
      }>;
      if (!teachers?.length) {
        await sendMessage(
          token,
          chatId,
          "Учитель ещё не назначен. Администрация скоро добавит.",
        );
        return;
      }
      const body = teachers
        .map(
          (t, i) =>
            `${i + 1}. <b>${escapeHtml(t.full_name || "—")}</b>`,
        )
        .join("\n");
      await sendMessage(token, chatId, `<b>Ваши учителя</b>\n\n${body}`);
      return;
    }
  }

  await sendMessage(
    token,
    chatId,
    "Не понял. Нажмите «❓ Помощь» или /help",
    { reply_markup: studentKeyboard() },
  );
}
