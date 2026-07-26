/**
 * Domain events → Telegram pings (best-effort, never throws to callers).
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { escapeHtml, sendMessage } from "@/lib/telegram/api";
import { appBaseUrl } from "@/lib/telegram/api";

async function studentChatId(studentId: string): Promise<number | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("students")
    .select("telegram_chat_id, full_name, student_code")
    .eq("id", studentId)
    .maybeSingle();
  const id = data?.telegram_chat_id;
  return id ? Number(id) : null;
}

async function teacherChatId(teacherId: string): Promise<number | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("teachers")
    .select("telegram_chat_id")
    .eq("id", teacherId)
    .maybeSingle();
  const id = data?.telegram_chat_id;
  return id ? Number(id) : null;
}

async function studentBrief(studentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("students")
    .select("full_name, student_code")
    .eq("id", studentId)
    .maybeSingle();
  return data;
}

async function teacherBrief(teacherId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("teachers")
    .select("full_name, teacher_code")
    .eq("id", teacherId)
    .maybeSingle();
  return data;
}

/** Учителю: новый ученик в группе */
export async function notifyTeacherNewStudent(
  teacherId: string,
  studentId: string,
): Promise<void> {
  try {
    const token = process.env.TELEGRAM_TEACHER_BOT_TOKEN?.trim();
    if (!token) return;
    const chatId = await teacherChatId(teacherId);
    if (!chatId) return;
    const s = await studentBrief(studentId);
    const base = appBaseUrl();
    await sendMessage(
      token,
      chatId,
      [
        `🆕 <b>Новый ученик в вашей группе</b>`,
        ``,
        `👤 ${escapeHtml(s?.full_name || "—")}`,
        `🔑 <code>${escapeHtml(s?.student_code || "")}</code>`,
        ``,
        `Отметьте посещаемость в боте или на сайте.`,
        `${base}/teacher/login`,
      ].join("\n"),
    );
  } catch (e) {
    console.error("notifyTeacherNewStudent", e);
  }
}

/** Ученику: новая оценка */
export async function notifyStudentNewGrade(input: {
  student_id: string;
  teacher_id: string;
  title: string;
  score: number;
  max_score?: number;
}): Promise<void> {
  try {
    const token = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
    if (!token) return;
    const chatId = await studentChatId(input.student_id);
    if (!chatId) return;
    const t = await teacherBrief(input.teacher_id);
    const max = input.max_score ?? 100;
    await sendMessage(
      token,
      chatId,
      [
        `📊 <b>Новая оценка</b>`,
        ``,
        `${escapeHtml(input.title)}: <b>${input.score}/${max}</b>`,
        t?.full_name ? `👨‍🏫 ${escapeHtml(t.full_name)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } catch (e) {
    console.error("notifyStudentNewGrade", e);
  }
}

/** Ученику: отметка посещаемости */
export async function notifyStudentAttendance(input: {
  student_id: string;
  status: string;
  lesson_date?: string;
}): Promise<void> {
  try {
    const token = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
    if (!token) return;
    const chatId = await studentChatId(input.student_id);
    if (!chatId) return;
    const label: Record<string, string> = {
      present: "✅ Присутствие",
      late: "⏰ Опоздание",
      absent: "❌ Отсутствие",
      excused: "📝 Уважительная",
    };
    await sendMessage(
      token,
      chatId,
      [
        `📅 <b>Посещаемость</b>`,
        input.lesson_date || new Date().toISOString().slice(0, 10),
        label[input.status] || input.status,
      ].join("\n"),
    );
  } catch (e) {
    console.error("notifyStudentAttendance", e);
  }
}

/** Ученику: оплата отмечена */
export async function notifyStudentPayment(input: {
  student_id: string;
  status: string;
  amount_paid?: number;
}): Promise<void> {
  try {
    const token = process.env.TELEGRAM_STUDENT_BOT_TOKEN?.trim();
    if (!token) return;
    const chatId = await studentChatId(input.student_id);
    if (!chatId) return;
    await sendMessage(
      token,
      chatId,
      [
        `💳 <b>Оплата обновлена</b>`,
        `Статус: <b>${escapeHtml(input.status)}</b>`,
        input.amount_paid != null ? `Сумма: ${input.amount_paid}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } catch (e) {
    console.error("notifyStudentPayment", e);
  }
}
