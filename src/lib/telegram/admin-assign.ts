import { getSupabaseServerClient } from "@/lib/supabase/server";
import { assignStudentToTeacher } from "@/lib/groups";
import { escapeHtml, inlineKeyboard } from "@/lib/telegram/api";

export type StudentHit = {
  id: string;
  full_name: string | null;
  student_code: string;
  phone: string | null;
  password_plain: string | null;
};

export type TeacherHit = {
  id: string;
  full_name: string | null;
  teacher_code: string;
};

/** Быстрый поиск: имя, логин, телефон (ilike). */
export async function searchStudents(query: string, limit = 10): Promise<StudentHit[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const q = query.trim();
  if (q.length < 1) return [];

  const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  // Parallel search fields
  const [byName, byCode, byPhone] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, student_code, phone, password_plain")
      .ilike("full_name", pattern)
      .limit(limit),
    supabase
      .from("students")
      .select("id, full_name, student_code, phone, password_plain")
      .ilike("student_code", pattern)
      .limit(limit),
    supabase
      .from("students")
      .select("id, full_name, student_code, phone, password_plain")
      .ilike("phone", pattern)
      .limit(limit),
  ]);

  const map = new Map<string, StudentHit>();
  for (const res of [byName, byCode, byPhone]) {
    for (const row of res.data ?? []) {
      map.set(row.id, row as StudentHit);
    }
  }
  return Array.from(map.values()).slice(0, limit);
}

export async function listActiveTeachers(): Promise<TeacherHit[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, teacher_code, status")
    .order("full_name", { ascending: true })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((t) => !t.status || t.status === "active")
    .map((t) => ({
      id: t.id,
      full_name: t.full_name,
      teacher_code: t.teacher_code,
    }));
}

export async function getStudentBrief(studentId: string): Promise<StudentHit | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("students")
    .select("id, full_name, student_code, phone, password_plain")
    .eq("id", studentId)
    .maybeSingle();
  return (data as StudentHit) || null;
}

export async function getTeacherBrief(teacherId: string): Promise<TeacherHit | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("teachers")
    .select("id, full_name, teacher_code")
    .eq("id", teacherId)
    .maybeSingle();
  return (data as TeacherHit) || null;
}

export async function assignTeacherToStudent(
  studentId: string,
  teacherId: string,
): Promise<{ ok: true; group_id: string } | { ok: false; error: string }> {
  try {
    const result = await assignStudentToTeacher(studentId, teacherId);
    return { ok: true, group_id: result.group_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка назначения",
    };
  }
}

/** Кнопки выбора учителя (callback asg:t:teacherId — student в session). */
export function teacherPickKeyboard(teachers: TeacherHit[]) {
  const rows = teachers.map((t) => [
    {
      text: `${t.full_name || "Учитель"} (${t.teacher_code})`.slice(0, 60),
      // asg:t:uuid = 6+36 = 42 < 64
      callback_data: `asg:t:${t.id}`,
    },
  ]);
  rows.push([{ text: "❌ Отмена", callback_data: "asg:cancel" }]);
  return inlineKeyboard(rows);
}

export function studentResultKeyboard(studentId: string) {
  return inlineKeyboard([
    [
      {
        text: "👨‍🏫 Назначить учителя",
        // asg:s:uuid = 6+36 = 42
        callback_data: `asg:s:${studentId}`,
      },
    ],
  ]);
}

export function formatStudentCard(s: StudentHit, teacherName?: string | null) {
  return [
    `👤 <b>${escapeHtml(s.full_name || "—")}</b>`,
    `🔑 <code>${escapeHtml(s.student_code)}</code>`,
    s.password_plain
      ? `🔐 <code>${escapeHtml(s.password_plain)}</code>`
      : null,
    s.phone ? `📞 ${escapeHtml(s.phone)}` : null,
    teacherName ? `👨‍🏫 ${escapeHtml(teacherName)}` : `👨‍🏫 не назначен`,
  ]
    .filter(Boolean)
    .join("\n");
}
