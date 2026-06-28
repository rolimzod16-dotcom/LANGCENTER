import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function addGrade(input: {
  student_id: string;
  teacher_id: string;
  title: string;
  score: number;
  max_score?: number;
  comment?: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("grades")
    .insert({
      student_id: input.student_id,
      teacher_id: input.teacher_id,
      title: input.title,
      score: input.score,
      max_score: input.max_score ?? 100,
      comment: input.comment ?? null,
    })
    .select("id, title, score, max_score, graded_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getStudentGrades(studentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("grades")
    .select("id, title, score, max_score, comment, graded_at, teachers(full_name)")
    .eq("student_id", studentId)
    .order("graded_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    score: g.score,
    max_score: g.max_score,
    comment: g.comment,
    graded_at: g.graded_at,
    teacher_name:
      (g.teachers as unknown as { full_name: string } | null)?.full_name ?? "",
  }));
}