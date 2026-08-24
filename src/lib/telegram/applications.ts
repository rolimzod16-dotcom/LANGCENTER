import { customAlphabet } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { registerPublicStudent } from "@/lib/students";
import {
  appBaseUrl,
  escapeHtml,
  inlineKeyboard,
  sendMessage,
} from "@/lib/telegram/api";
import { listAdminChatIds } from "@/lib/telegram/admin-store";

const genLogin = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const genPass = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789",
  8,
);

export type TrialApplication = {
  id: string;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  full_name: string;
  phone: string | null;
  course: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string;
  student_id: string | null;
  login_code: string | null;
  plain_password: string | null;
  created_at: string;
};

export async function createTrialApplication(input: {
  telegram_chat_id: number;
  telegram_username?: string | null;
  full_name: string;
  phone?: string;
  course?: string;
  preferred_date?: string;
  preferred_time?: string;
}): Promise<TrialApplication> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("БД не настроена");

  const { data, error } = await supabase
    .from("trial_applications")
    .insert({
      telegram_chat_id: input.telegram_chat_id,
      telegram_username: input.telegram_username ?? null,
      full_name: input.full_name.trim(),
      phone: input.phone?.trim() || null,
      course: input.course?.trim() || null,
      preferred_date: input.preferred_date || null,
      preferred_time: input.preferred_time?.trim() || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as TrialApplication;
}

export async function getTrialApplication(
  id: string,
): Promise<TrialApplication | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("trial_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as TrialApplication) || null;
}

export async function listPendingApplications(limit = 15) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("trial_applications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TrialApplication[];
}

function formatApp(app: TrialApplication): string {
  return [
    `👤 <b>${escapeHtml(app.full_name)}</b>`,
    app.phone ? `📞 ${escapeHtml(app.phone)}` : null,
    app.course ? `📚 ${escapeHtml(app.course)}` : null,
    app.preferred_date
      ? `📅 ${escapeHtml(app.preferred_date)}`
      : null,
    app.preferred_time
      ? `🕐 ${escapeHtml(app.preferred_time)}`
      : null,
    app.telegram_username
      ? `TG: @${escapeHtml(app.telegram_username)}`
      : app.telegram_chat_id
        ? `TG chat: <code>${app.telegram_chat_id}</code>`
        : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Уведомить админов о заявке с кнопками Принять / Отклонить */
export async function notifyAdminsTrialApplication(
  app: TrialApplication,
): Promise<void> {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim();
  if (!token) return;
  const chats = await listAdminChatIds();
  if (!chats.length) return;

  const text = [
    `📝 <b>Заявка на пробный урок</b>`,
    ``,
    formatApp(app),
    ``,
    `ID: <code>${app.id.slice(0, 8)}…</code>`,
  ].join("\n");

  const markup = inlineKeyboard([
    [
      { text: "✅ Принять", callback_data: `lead:accept:${app.id}` },
      { text: "❌ Отклонить", callback_data: `lead:reject:${app.id}` },
    ],
    [{ text: "👥 Все заявки", callback_data: "lead:list" }],
  ]);

  await Promise.allSettled(
    chats.map((chatId) =>
      sendMessage(token, chatId, text, { reply_markup: markup }),
    ),
  );
}

/**
 * Принять заявку: создать ученика, выдать логин/пароль, уведомить ученика.
 */
export async function acceptTrialApplication(
  appId: string,
  adminChatId: number,
): Promise<{ ok: true; app: TrialApplication } | { ok: false; error: string }> {
  const app = await getTrialApplication(appId);
  if (!app) return { ok: false, error: "Заявка не найдена" };
  if (app.status !== "pending") {
    return { ok: false, error: `Уже обработана: ${app.status}` };
  }

  const parts = app.full_name.trim().split(/\s+/);
  const last_name = parts[0] || "Ученик";
  const first_name = parts.slice(1).join(" ") || parts[0] || "Новый";

  const year = new Date().getFullYear();
  const login = `STU-${year}-${genLogin()}`;
  const password = genPass();

  try {
    const student = await registerPublicStudent({
      first_name,
      last_name,
      phone: app.phone || undefined,
      login,
      password,
      preferred_course: app.course || undefined,
      preferred_schedule: [app.preferred_date, app.preferred_time]
        .filter(Boolean)
        .join(" ") || undefined,
    });

    // link telegram if we have chat
    if (app.telegram_chat_id) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        await supabase
          .from("students")
          .update({ telegram_chat_id: app.telegram_chat_id })
          .eq("id", student.id);
      }
    }

    const supabase = getSupabaseServerClient()!;
    const { data: updated, error } = await supabase
      .from("trial_applications")
      .update({
        status: "accepted",
        student_id: student.id,
        login_code: student.student_code,
        plain_password: student.plain_password,
        resolved_at: new Date().toISOString(),
        resolved_by_chat_id: adminChatId,
      })
      .eq("id", appId)
      .select("*")
      .single();

    if (error) return { ok: false, error: error.message };

    // notify student
    const studentToken = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
    if (studentToken && app.telegram_chat_id) {
      const base = appBaseUrl();
      await sendMessage(
        studentToken,
        app.telegram_chat_id,
        [
          `✅ <b>Заявка принята!</b>`,
          ``,
          `Добро пожаловать в Lang Center.`,
          `Пробный: ${escapeHtml(app.preferred_date || "—")} ${escapeHtml(app.preferred_time || "")}`,
          ``,
          `🔑 Логин: <code>${escapeHtml(student.student_code)}</code>`,
          `🔐 Пароль: <code>${escapeHtml(student.plain_password)}</code>`,
          ``,
          `Кабинет: ${base}/student/login`,
          `В боте: /login ${escapeHtml(student.student_code)} ${escapeHtml(student.plain_password)}`,
        ].join("\n"),
      );
    }

    return { ok: true, app: updated as TrialApplication };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка создания ученика",
    };
  }
}

export async function rejectTrialApplication(
  appId: string,
  adminChatId: number,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const app = await getTrialApplication(appId);
  if (!app) return { ok: false, error: "Заявка не найдена" };
  if (app.status !== "pending") {
    return { ok: false, error: `Уже обработана: ${app.status}` };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "БД не настроена" };

  const { error } = await supabase
    .from("trial_applications")
    .update({
      status: "rejected",
      admin_note: reason || null,
      resolved_at: new Date().toISOString(),
      resolved_by_chat_id: adminChatId,
    })
    .eq("id", appId);

  if (error) return { ok: false, error: error.message };

  const studentToken = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
  if (studentToken && app.telegram_chat_id) {
    await sendMessage(
      studentToken,
      app.telegram_chat_id,
      [
        `❌ <b>Заявка отклонена</b>`,
        reason ? `\nПричина: ${escapeHtml(reason)}` : "",
        `\nМожете записаться снова или позвонить в центр.`,
      ].join(""),
    );
  }

  return { ok: true };
}

export { formatApp };
