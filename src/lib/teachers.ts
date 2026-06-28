import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const generateCodePart = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const generatePassword = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789",
  10,
);

export type TeacherRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  teacher_code: string;
  status: string;
  created_at: string;
};

export async function listTeachers(): Promise<TeacherRow[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, phone, email, teacher_code, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function generateTeacherCode(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
) {
  const year = new Date().getFullYear();
  for (let i = 0; i < 20; i++) {
    const code = `TCH-${year}-${generateCodePart()}`;
    const { data } = await supabase
      .from("teachers")
      .select("id")
      .eq("teacher_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Не удалось сгенерировать код учителя");
}

export async function createTeacher(input: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  group_name?: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const teacherCode = await generateTeacherCode(supabase);
  const plainPassword = generatePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, 10);
  const fullName = `${input.last_name.trim()} ${input.first_name.trim()}`.trim();

  const { data: teacher, error } = await supabase
    .from("teachers")
    .insert({
      full_name: fullName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      teacher_code: teacherCode,
      password_hash: passwordHash,
      status: "active",
    })
    .select("id, full_name, teacher_code")
    .single();

  if (error) throw new Error(error.message);

  const groupName = input.group_name?.trim() || `Группа ${input.last_name}`;
  const { error: groupError } = await supabase.from("groups").insert({
    teacher_id: teacher.id,
    name: groupName,
  });

  if (groupError) throw new Error(groupError.message);

  return {
    ...teacher,
    plain_password: plainPassword,
  };
}

export async function loginTeacher(code: string, password: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, teacher_code, password_hash, status")
    .eq("teacher_code", code.trim().toUpperCase())
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.password_hash || !bcrypt.compareSync(password, data.password_hash)) {
    return null;
  }

  const { password_hash: _, ...teacher } = data;
  return teacher;
}

export async function resetTeacherPassword(teacherId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const plainPassword = generatePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, 10);

  const { data, error } = await supabase
    .from("teachers")
    .update({ password_hash: passwordHash })
    .eq("id", teacherId)
    .select("teacher_code, full_name")
    .single();

  if (error) throw new Error(error.message);
  return { ...data, plain_password: plainPassword };
}