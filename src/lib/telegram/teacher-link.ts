import { loginTeacher } from "@/lib/teachers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTeacherStudents } from "@/lib/groups";

export async function linkTeacherTelegram(
  code: string,
  password: string,
  chatId: number,
): Promise<
  | { ok: true; teacher_code: string; full_name: string; id: string }
  | { ok: false; error: string }
> {
  const teacher = await loginTeacher(code.trim().toUpperCase(), password);
  if (!teacher) {
    return { ok: false, error: "Неверный код или пароль учителя" };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "БД не настроена" };

  const { error } = await supabase
    .from("teachers")
    .update({ telegram_chat_id: chatId })
    .eq("id", teacher.id);

  if (error && !error.message.toLowerCase().includes("telegram_chat_id")) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    id: teacher.id,
    teacher_code: teacher.teacher_code,
    full_name: teacher.full_name,
  };
}

export async function findTeacherByChatId(chatId: number) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, teacher_code, status")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status && data.status !== "active") return null;
  return data as {
    id: string;
    full_name: string;
    teacher_code: string;
    status: string;
  };
}

export async function listTeacherStudents(teacherId: string) {
  const rows = await getTeacherStudents(teacherId);
  return rows.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    student_code: s.student_code,
    phone: s.phone,
    status: "active" as string | null,
    group_name: s.group_name,
  }));
}
