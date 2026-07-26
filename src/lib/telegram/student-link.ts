import { loginStudent } from "@/lib/students";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentAttendance } from "@/lib/attendance";
import { getStudentGrades } from "@/lib/grades";
import { getStudentTeachers } from "@/lib/groups";
import { getStudentPaymentStatus } from "@/lib/payments";

export async function linkStudentTelegram(
  login: string,
  password: string,
  chatId: number,
): Promise<
  | { ok: true; student_code: string; full_name: string }
  | { ok: false; error: string }
> {
  const student = await loginStudent(login, password);
  if (!student) {
    return { ok: false, error: "Неверный логин или пароль" };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "БД не настроена" };
  }

  // best-effort save chat id
  const { error } = await supabase
    .from("students")
    .update({ telegram_chat_id: chatId })
    .eq("id", student.id);

  if (error) {
    // column missing — still allow "session" for this request via notes? skip
    if (!error.message.toLowerCase().includes("telegram_chat_id")) {
      return { ok: false, error: error.message };
    }
  }

  const name =
    `${student.last_name} ${student.first_name}`.trim() || student.student_code;

  return {
    ok: true,
    student_code: student.student_code,
    full_name: name,
  };
}

export async function findStudentByChatId(chatId: number) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, student_code, phone, status")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (error || !data) return null;
  return data as {
    id: string;
    full_name: string | null;
    student_code: string;
    phone: string | null;
    status?: string | null;
  };
}

export async function studentCabinetSummary(studentId: string) {
  const [teachers, grades, attendance, payment] = await Promise.all([
    getStudentTeachers(studentId),
    getStudentGrades(studentId),
    getStudentAttendance(studentId),
    getStudentPaymentStatus(studentId),
  ]);

  return { teachers, grades, attendance, payment };
}
