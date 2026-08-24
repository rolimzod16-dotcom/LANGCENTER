import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { createShiftsForTeacher, parseShiftNames } from "@/lib/groups";
import { getAdminOrgId, orgInsertFields } from "@/lib/org";
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
  organization_id?: string | null;
};

export async function listTeachers(
  organizationId?: string | null,
): Promise<TeacherRow[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const orgId =
    organizationId === undefined ? await getAdminOrgId() : organizationId;

  let query = supabase
    .from("teachers")
    .select(
      "id, full_name, phone, email, teacher_code, status, created_at, organization_id",
    )
    .order("created_at", { ascending: false });

  if (orgId) {
    query = query.eq("organization_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.toLowerCase().includes("organization_id")) {
      const fallback = await supabase
        .from("teachers")
        .select("id, full_name, phone, email, teacher_code, status, created_at")
        .order("created_at", { ascending: false });
      if (fallback.error) throw new Error(fallback.error.message);
      return (fallback.data ?? []) as TeacherRow[];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as TeacherRow[];
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
  group_names?: string[];
  organization_id?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const teacherCode = await generateTeacherCode(supabase);
  const plainPassword = generatePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, 10);
  const fullName = `${input.last_name.trim()} ${input.first_name.trim()}`.trim();
  const orgId =
    input.organization_id === undefined
      ? await getAdminOrgId()
      : input.organization_id;
  const orgFields = await orgInsertFields(orgId);

  const insertPayload: Record<string, unknown> = {
    full_name: fullName,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    teacher_code: teacherCode,
    password_hash: passwordHash,
    status: "active",
    ...orgFields,
  };

  let teacher: { id: string; full_name: string; teacher_code: string } | null =
    null;

  const { data, error } = await supabase
    .from("teachers")
    .insert(insertPayload)
    .select("id, full_name, teacher_code")
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("organization_id")) {
      delete insertPayload.organization_id;
      const retry = await supabase
        .from("teachers")
        .insert(insertPayload)
        .select("id, full_name, teacher_code")
        .single();
      if (retry.error) throw new Error(retry.error.message);
      teacher = retry.data;
    } else {
      throw new Error(error.message);
    }
  } else {
    teacher = data;
  }

  if (!teacher) throw new Error("Не удалось создать учителя");

  const shiftNames = [
    ...(input.group_names ?? []),
    ...parseShiftNames(input.group_name),
  ];
  const shifts = await createShiftsForTeacher(
    teacher.id,
    shiftNames.length ? shiftNames : ["Основная смена"],
    orgId,
  );

  return {
    ...teacher,
    plain_password: plainPassword,
    shifts: shifts.map((s) => ({ id: s.id, name: s.name })),
  };
}

export async function loginTeacher(code: string, password: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  type TeacherAuthRow = {
    id: string;
    full_name: string;
    teacher_code: string;
    password_hash: string;
    status: string;
    organization_id?: string | null;
  };

  let data: TeacherAuthRow | null = null;

  const first = await supabase
    .from("teachers")
    .select(
      "id, full_name, teacher_code, password_hash, status, organization_id",
    )
    .eq("teacher_code", code.trim().toUpperCase())
    .eq("status", "active")
    .maybeSingle();

  if (first.error?.message.toLowerCase().includes("organization_id")) {
    const second = await supabase
      .from("teachers")
      .select("id, full_name, teacher_code, password_hash, status")
      .eq("teacher_code", code.trim().toUpperCase())
      .eq("status", "active")
      .maybeSingle();
    if (second.error) throw new Error(second.error.message);
    data = second.data as TeacherAuthRow | null;
  } else if (first.error) {
    throw new Error(first.error.message);
  } else {
    data = first.data as TeacherAuthRow | null;
  }

  if (!data?.password_hash || !bcrypt.compareSync(password, data.password_hash)) {
    return null;
  }

  return {
    id: data.id,
    full_name: data.full_name,
    teacher_code: data.teacher_code,
    status: data.status,
    organization_id: data.organization_id ?? null,
  };
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
