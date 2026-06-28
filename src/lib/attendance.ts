import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AttendanceStatus = "present" | "absent" | "late";

export async function markAttendance(input: {
  student_id: string;
  teacher_id: string;
  status: AttendanceStatus;
  lesson_date?: string;
  note?: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const lessonDate = input.lesson_date ?? new Date().toISOString().slice(0, 10);

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
      },
      { onConflict: "student_id,teacher_id,lesson_date" },
    )
    .select("id, status, lesson_date")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getStudentAttendance(studentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("attendance")
    .select("id, status, lesson_date, note, teachers(full_name)")
    .eq("student_id", studentId)
    .order("lesson_date", { ascending: false });

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