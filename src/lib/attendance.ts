import { assertStudentAssignedToTeacher } from "@/lib/groups";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { orgInsertFields } from "@/lib/org";

export type AttendanceStatus = "present" | "absent" | "late";

export async function markAttendance(input: {
  student_id: string;
  teacher_id: string;
  status: AttendanceStatus;
  lesson_date?: string;
  note?: string;
  skipAcl?: boolean;
  organization_id?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  if (!input.skipAcl) {
    await assertStudentAssignedToTeacher(input.student_id, input.teacher_id);
  }

  const lessonDate = input.lesson_date ?? new Date().toISOString().slice(0, 10);
  const orgFields = await orgInsertFields(input.organization_id);

  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        student_id: input.student_id,
        teacher_id: input.teacher_id,
        status: input.status,
        lesson_date: lessonDate,
        note: input.note ?? null,
        marked_at: new Date().toISOString(),
        ...orgFields,
      },
      { onConflict: "student_id,teacher_id,lesson_date" },
    )
    .select("id, status, lesson_date, student_id")
    .single();

  if (error) throw new Error(error.message);

  void import("@/lib/telegram/notify-events").then((m) =>
    m.notifyStudentAttendance({
      student_id: input.student_id,
      status: input.status,
      lesson_date: lessonDate,
    }),
  );

  return data;
}

/** Массовая отметка посещаемости (один round-trip batch upsert). */
export async function markAttendanceBulk(input: {
  teacher_id: string;
  student_ids: string[];
  status: AttendanceStatus;
  lesson_date?: string;
  organization_id?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { getStudentIdsForTeacher } = await import("@/lib/groups");
  const allowed = new Set(await getStudentIdsForTeacher(input.teacher_id));
  const ids = input.student_ids.filter((id) => allowed.has(id));
  if (!ids.length) {
    throw new Error("Нет учеников из ваших групп для отметки");
  }

  const lessonDate = input.lesson_date ?? new Date().toISOString().slice(0, 10);
  const orgFields = await orgInsertFields(input.organization_id);
  const rows = ids.map((student_id) => ({
    student_id,
    teacher_id: input.teacher_id,
    status: input.status,
    lesson_date: lessonDate,
    note: null as string | null,
    marked_at: new Date().toISOString(),
    ...orgFields,
  }));

  const { data, error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,teacher_id,lesson_date" })
    .select("id, status, lesson_date, student_id");

  if (error) throw new Error(error.message);
  return {
    marked: data?.length ?? ids.length,
    student_ids: ids,
    status: input.status,
    lesson_date: lessonDate,
  };
}

export async function getTodayAttendanceForTeacher(
  teacherId: string,
  studentIds: string[],
): Promise<Record<string, AttendanceStatus>> {
  const map: Record<string, AttendanceStatus> = {};
  if (!studentIds.length) return map;

  const supabase = getSupabaseServerClient();
  if (!supabase) return map;

  const lessonDate = new Date().toISOString().slice(0, 10);
  const chunkSize = 200;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("teacher_id", teacherId)
      .eq("lesson_date", lessonDate)
      .in("student_id", chunk);

    if (error) continue;
    for (const row of data ?? []) {
      map[row.student_id] = row.status as AttendanceStatus;
    }
  }

  return map;
}

export async function getStudentAttendance(studentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("attendance")
    .select("id, status, lesson_date, note, teachers(full_name)")
    .eq("student_id", studentId)
    .order("lesson_date", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data ?? []).map((a) => ({
    id: a.id,
    status: a.status,
    lesson_date: a.lesson_date,
    note: a.note,
    teacher_name:
      (a.teachers as unknown as { full_name: string } | null)?.full_name ?? "",
  }));
}
