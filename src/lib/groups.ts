import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function assignStudentToTeacher(
  studentId: string,
  teacherId: string,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id")
    .eq("teacher_id", teacherId)
    .limit(1)
    .maybeSingle();

  if (groupError) throw new Error(groupError.message);
  if (!group) throw new Error("У учителя нет группы");

  const { error } = await supabase.from("group_students").upsert(
    { group_id: group.id, student_id: studentId },
    { onConflict: "group_id,student_id" },
  );

  if (error) throw new Error(error.message);
  return { group_id: group.id };
}

export async function getTeacherForStudent(studentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("group_students")
    .select("groups(name, teachers(full_name))")
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  if (!data?.groups) return null;
  const g = data.groups as unknown as {
    name: string;
    teachers: { full_name: string };
  };
  return { group_name: g.name, teacher_name: g.teachers.full_name };
}

export async function getTeacherStudents(teacherId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("id, name")
    .eq("teacher_id", teacherId);

  if (gErr) throw new Error(gErr.message);
  if (!groups?.length) return [];

  const groupIds = groups.map((g) => g.id);
  const { data, error } = await supabase
    .from("group_students")
    .select("student_id, students(id, full_name, student_code, phone)")
    .in("group_id", groupIds);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const s = row.students as unknown as {
      id: string;
      full_name: string;
      student_code: string;
      phone: string | null;
    };
    return {
      id: s.id,
      full_name: s.full_name,
      student_code: s.student_code,
      phone: s.phone,
      group_name: groups[0]?.name ?? "",
    };
  });
}

export async function getStudentTeachers(studentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("group_students")
    .select("group_id, groups(id, name, teachers(id, full_name, teacher_code))")
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const g = row.groups as unknown as {
      id: string;
      name: string;
      teachers: { id: string; full_name: string; teacher_code: string };
    };
    return {
      group_id: g.id,
      group_name: g.name,
      teacher_id: g.teachers.id,
      teacher_name: g.teachers.full_name,
      teacher_code: g.teachers.teacher_code,
    };
  });
}