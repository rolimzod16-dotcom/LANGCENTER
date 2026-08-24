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
  findTeacherByChatId,
  linkTeacherTelegram,
  listTeacherStudents,
} from "@/lib/telegram/teacher-link";
import {
  clearTgSession,
  getTgSession,
  setTgSession,
} from "@/lib/telegram/sessions";
import {
  markAttendance,
  getTodayAttendanceForTeacher,
  type AttendanceStatus,
} from "@/lib/attendance";
import { addGrade } from "@/lib/grades";

function teacherKeyboard() {
  return replyKeyboard([
    ["👥 Мои ученики", "✅ Посещаемость"],
    ["📊 Поставить оценку", "📅 Сегодня"],
    ["🔗 Войти", "🌐 Кабинет"],
    ["❌ Отмена", "❓ Помощь"],
  ]);
}

function parseLogin(text: string): { code: string; password: string } | null {
  const m =
    text.match(/^\/login(?:@\w+)?\s+(\S+)\s+(.+)$/i) ||
    text.match(/^войти\s+(\S+)\s+(.+)$/i);
  if (!m) return null;
  return { code: m[1]!.trim().toUpperCase(), password: m[2]!.trim() };
}

async function requireTeacher(token: string, chatId: number) {
  const t = await findTeacherByChatId(chatId);
  if (!t) {
    await sendMessage(
      token,
      chatId,
      "Сначала привяжите кабинет:\n<code>/login TCH-2026-XXXXXX пароль</code>\n\nКод и пароль выдаёт администратор.",
      { reply_markup: teacherKeyboard() },
    );
    return null;
  }
  return t;
}

async function sendHelp(token: string, chatId: number) {
  const base = appBaseUrl();
  await sendMessage(
    token,
    chatId,
    [
      `<b>Lang Center — бот учителя</b>`,
      ``,
      `Веб-кабинет: ${base}/teacher/login`,
      ``,
      `Здесь в Telegram:`,
      `• 👥 список учеников`,
      `• ✅ посещаемость (сегодня)`,
      `• 📊 оценки`,
      ``,
      `Вход: <code>/login TCH-… пароль</code>`,
    ].join("\n"),
    { reply_markup: teacherKeyboard() },
  );
}

async function showStudents(token: string, chatId: number, teacherId: string) {
  const students = await listTeacherStudents(teacherId);
  if (!students.length) {
    await sendMessage(
      token,
      chatId,
      "Пока нет учеников. Админ назначит их вам.",
    );
    return;
  }
  const today = await getTodayAttendanceForTeacher(
    teacherId,
    students.map((s) => s.id),
  );
  const label: Record<string, string> = {
    present: "✅",
    late: "⏰",
    absent: "❌",
  };

  await sendMessage(
    token,
    chatId,
    `<b>Ваши ученики (${students.length})</b>`,
  );

  for (const s of students) {
    const mark = today[s.id] ? label[today[s.id]!] || today[s.id] : "·";
    await sendMessage(
      token,
      chatId,
      `${mark} <b>${escapeHtml(s.full_name || "—")}</b>\n<code>${escapeHtml(s.student_code)}</code>${
        s.group_name ? `\n📅 ${escapeHtml(s.group_name)}` : ""
      }`,
      {
        reply_markup: inlineKeyboard([
          [
            { text: "✅", callback_data: `a:p:${s.id}` },
            { text: "⏰", callback_data: `a:l:${s.id}` },
            { text: "❌", callback_data: `a:x:${s.id}` },
            { text: "📊", callback_data: `g:s:${s.id}` },
          ],
        ]),
      },
    );
  }
}

async function showAttendancePanel(
  token: string,
  chatId: number,
  teacherId: string,
) {
  const students = await listTeacherStudents(teacherId);
  if (!students.length) {
    await sendMessage(token, chatId, "Нет учеников для отметки.");
    return;
  }
  const today = await getTodayAttendanceForTeacher(
    teacherId,
    students.map((s) => s.id),
  );

  await sendMessage(
    token,
    chatId,
    `✅ <b>Посещаемость сегодня</b>\nОтметьте каждого:`,
    {
      reply_markup: inlineKeyboard([
        [
          {
            text: "✅ Все пришли",
            callback_data: "a:all:present",
          },
        ],
      ]),
    },
  );

  for (const s of students) {
    const cur = today[s.id];
    const badge =
      cur === "present" ? "✅" : cur === "late" ? "⏰" : cur === "absent" ? "❌" : "⬜";
    await sendMessage(
      token,
      chatId,
      `${badge} ${escapeHtml(s.full_name || s.student_code)}`,
      {
        reply_markup: inlineKeyboard([
          [
            { text: "✅ Был", callback_data: `a:p:${s.id}` },
            { text: "⏰ Опозд.", callback_data: `a:l:${s.id}` },
            { text: "❌ Нет", callback_data: `a:x:${s.id}` },
          ],
        ]),
      },
    );
  }
}

async function startGrade(
  token: string,
  chatId: number,
  teacherId: string,
  studentId?: string,
) {
  if (studentId) {
    await setTgSession(chatId, "teacher", "grade_title", {
      student_id: studentId,
      teacher_id: teacherId,
    });
    await sendMessage(token, chatId, "Название оценки:", {
      reply_markup: inlineKeyboard([
        [
          { text: "Урок", callback_data: "g:t:Урок" },
          { text: "ДЗ", callback_data: "g:t:ДЗ" },
          { text: "Тест", callback_data: "g:t:Тест" },
        ],
        [{ text: "❌ Отмена", callback_data: "g:cancel" }],
      ]),
    });
    return;
  }

  const students = await listTeacherStudents(teacherId);
  if (!students.length) {
    await sendMessage(token, chatId, "Нет учеников.");
    return;
  }

  await setTgSession(chatId, "teacher", "grade_pick_student", {
    teacher_id: teacherId,
  });

  const rows = students.slice(0, 25).map((s) => [
    {
      text: (s.full_name || s.student_code).slice(0, 40),
      callback_data: `g:s:${s.id}`,
    },
  ]);
  rows.push([{ text: "❌ Отмена", callback_data: "g:cancel" }]);

  await sendMessage(token, chatId, "📊 Кому поставить оценку?", {
    reply_markup: inlineKeyboard(rows),
  });
}

export async function handleTeacherBotUpdate(update: TgUpdate): Promise<void> {
  const token = process.env.TELEGRAM_TEACHER_BOT_TOKEN?.trim();
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

    const teacher = await findTeacherByChatId(chatId);
    if (!teacher && !data.startsWith("noop")) {
      await answerCallback(token, cbId, "Сначала /login");
      return;
    }

    // attendance
    if (data.startsWith("a:p:") || data.startsWith("a:l:") || data.startsWith("a:x:")) {
      if (!teacher) return;
      const statusMap: Record<string, AttendanceStatus> = {
        p: "present",
        l: "late",
        x: "absent",
      };
      const key = data[2] as "p" | "l" | "x";
      const studentId = data.slice(4);
      const status = statusMap[key] || "present";
      try {
        await markAttendance({
          student_id: studentId,
          teacher_id: teacher.id,
          status,
        });
        const label =
          status === "present" ? "✅ был" : status === "late" ? "⏰ опоздал" : "❌ не был";
        await answerCallback(token, cbId, label);
      } catch (e) {
        await answerCallback(token, cbId, "Ошибка");
        await sendMessage(
          token,
          chatId,
          `⚠️ ${e instanceof Error ? e.message : "ошибка"}`,
        );
      }
      return;
    }

    if (data === "a:all:present") {
      if (!teacher) return;
      try {
        const students = await listTeacherStudents(teacher.id);
        let n = 0;
        for (const s of students) {
          await markAttendance({
            student_id: s.id,
            teacher_id: teacher.id,
            status: "present",
          });
          n++;
        }
        await answerCallback(token, cbId, `Отмечено ${n}`);
        await sendMessage(token, chatId, `✅ Все пришли (${n})`);
      } catch (e) {
        await answerCallback(token, cbId, "Ошибка");
        await sendMessage(
          token,
          chatId,
          e instanceof Error ? e.message : "ошибка",
        );
      }
      return;
    }

    // grade: pick student
    if (data.startsWith("g:s:")) {
      if (!teacher) return;
      const studentId = data.slice(4);
      await answerCallback(token, cbId);
      await startGrade(token, chatId, teacher.id, studentId);
      return;
    }

    // grade: title
    if (data.startsWith("g:t:")) {
      if (!teacher) return;
      const title = data.slice(4) || "Урок";
      const session = await getTgSession(chatId, "teacher");
      const studentId = String(session.data.student_id || "");
      if (!studentId) {
        await answerCallback(token, cbId, "Сначала ученик");
        return;
      }
      await setTgSession(chatId, "teacher", "grade_score", {
        student_id: studentId,
        teacher_id: teacher.id,
        title,
      });
      await answerCallback(token, cbId, title);
      await sendMessage(token, chatId, `Оценка «${escapeHtml(title)}». Балл:`, {
        reply_markup: inlineKeyboard([
          [
            { text: "100", callback_data: "g:sc:100" },
            { text: "90", callback_data: "g:sc:90" },
            { text: "80", callback_data: "g:sc:80" },
          ],
          [
            { text: "70", callback_data: "g:sc:70" },
            { text: "60", callback_data: "g:sc:60" },
            { text: "50", callback_data: "g:sc:50" },
          ],
          [{ text: "❌ Отмена", callback_data: "g:cancel" }],
        ]),
      });
      return;
    }

    // grade: score
    if (data.startsWith("g:sc:")) {
      if (!teacher) return;
      const score = Number(data.slice(5));
      const session = await getTgSession(chatId, "teacher");
      const studentId = String(session.data.student_id || "");
      const title = String(session.data.title || "Урок");
      if (!studentId || !Number.isFinite(score)) {
        await answerCallback(token, cbId, "Ошибка");
        return;
      }
      try {
        await addGrade({
          student_id: studentId,
          teacher_id: teacher.id,
          title,
          score,
          max_score: 100,
        });
        await clearTgSession(chatId, "teacher");
        await answerCallback(token, cbId, "Сохранено");
        await sendMessage(
          token,
          chatId,
          `✅ Оценка сохранена: <b>${escapeHtml(title)}</b> — ${score}/100`,
          { reply_markup: teacherKeyboard() },
        );
      } catch (e) {
        await answerCallback(token, cbId, "Ошибка");
        await sendMessage(
          token,
          chatId,
          e instanceof Error ? e.message : "ошибка",
        );
      }
      return;
    }

    if (data === "g:cancel") {
      await clearTgSession(chatId, "teacher");
      await answerCallback(token, cbId, "Отмена");
      await sendMessage(token, chatId, "Отменено.", {
        reply_markup: teacherKeyboard(),
      });
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

  if (text === "❌ Отмена" || text === "/cancel") {
    await clearTgSession(chatId, "teacher");
    await sendMessage(token, chatId, "Отменено.", {
      reply_markup: teacherKeyboard(),
    });
    return;
  }

  // free-text score during grade_score
  const session = await getTgSession(chatId, "teacher");
  if (session.state === "grade_score") {
    const teacher = await findTeacherByChatId(chatId);
    if (!teacher) return;
    const score = Number(text.replace(",", "."));
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      await sendMessage(token, chatId, "Введите число 0–100 или выберите кнопку.");
      return;
    }
    try {
      await addGrade({
        student_id: String(session.data.student_id),
        teacher_id: teacher.id,
        title: String(session.data.title || "Урок"),
        score,
        max_score: 100,
      });
      await clearTgSession(chatId, "teacher");
      await sendMessage(
        token,
        chatId,
        `✅ Оценка: ${score}/100`,
        { reply_markup: teacherKeyboard() },
      );
    } catch (e) {
      await sendMessage(
        token,
        chatId,
        e instanceof Error ? e.message : "ошибка",
      );
    }
    return;
  }

  if (text === "/start" || text === "/help" || text === "❓ Помощь") {
    await sendHelp(token, chatId);
    return;
  }

  if (text === "🔗 Войти" || text === "/link") {
    await sendMessage(
      token,
      chatId,
      "Пришлите:\n<code>/login TCH-2026-XXXXXX пароль</code>",
    );
    return;
  }

  const login = parseLogin(text);
  if (login) {
    const res = await linkTeacherTelegram(login.code, login.password, chatId);
    if (!res.ok) {
      await sendMessage(token, chatId, `❌ ${res.error}`);
      return;
    }
    await sendMessage(
      token,
      chatId,
      `✅ Привязано\n\n👨‍🏫 ${escapeHtml(res.full_name)}\n<code>${escapeHtml(res.teacher_code)}</code>`,
      { reply_markup: teacherKeyboard() },
    );
    return;
  }

  if (text === "🌐 Кабинет" || text === "/app") {
    await sendMessage(token, chatId, "Веб-кабинет учителя:", {
      reply_markup: inlineKeyboard([
        [{ text: "Открыть кабинет", url: `${base}/teacher/login` }],
      ]),
    });
    return;
  }

  const teacher = await requireTeacher(token, chatId);
  if (!teacher) return;

  if (text === "👥 Мои ученики" || text === "/students") {
    await showStudents(token, chatId, teacher.id);
    return;
  }

  if (
    text === "✅ Посещаемость" ||
    text === "📅 Сегодня" ||
    text === "/attendance"
  ) {
    await showAttendancePanel(token, chatId, teacher.id);
    return;
  }

  if (text === "📊 Поставить оценку" || text === "/grade") {
    await startGrade(token, chatId, teacher.id);
    return;
  }

  await sendMessage(token, chatId, "«❓ Помощь» или /help", {
    reply_markup: teacherKeyboard(),
  });
}
