import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const generateCodePart = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const generatePassword = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789",
  10,
);

export type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  student_code: string;
  is_active: boolean;
  created_at: string;
  start_date: string | null;
  payment_due_day: number | null;
};

export type CreateStudentResult = StudentRow & {
  plain_password: string;
};

type DbStudent = {
  id: string;
  full_name: string;
  phone: string | null;
  student_code: string;
  status: string;
  created_at: string;
  password_hash?: string;
  start_date?: string | null;
  payment_due_day?: number | null;
};

function parseFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }
  return {
    last_name: parts[0],
    first_name: parts.slice(1).join(" "),
  };
}

function mapStudent(row: DbStudent): StudentRow {
  const { first_name, last_name } = parseFullName(row.full_name);
  return {
    id: row.id,
    first_name,
    last_name,
    email: null,
    phone: row.phone,
    student_code: row.student_code,
    is_active: row.status === "active",
    created_at: row.created_at,
    start_date: row.start_date ?? null,
    payment_due_day: row.payment_due_day ?? null,
  };
}

async function generateUniqueCode(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 20; i++) {
    const code = `STU-${year}-${generateCodePart()}`;
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("student_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Не удалось сгенерировать код");
}

export async function listStudents(): Promise<StudentRow[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен. Проверь .env.local");

  const { data, error } = await supabase
    .from("students")
    .select(
      "id, full_name, phone, student_code, status, created_at, start_date, payment_due_day",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbStudent[]).map(mapStudent);
}

export async function createStudent(input: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  monthly_fee?: number;
  start_date?: string;
  payment_due_day?: number;
}): Promise<CreateStudentResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен. Проверь .env.local");

  const studentCode = await generateUniqueCode(supabase);
  const plainPassword = generatePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, 10);
  const fullName = `${input.last_name.trim()} ${input.first_name.trim()}`.trim();

  const insertRow: Record<string, unknown> = {
    full_name: fullName,
    phone: input.phone?.trim() || null,
    student_code: studentCode,
    password_hash: passwordHash,
    status: "active",
  };
  if (input.monthly_fee !== undefined && input.monthly_fee > 0) {
    insertRow.monthly_fee = input.monthly_fee;
  }
  if (input.start_date) {
    insertRow.start_date = input.start_date;
  }
  if (input.payment_due_day !== undefined) {
    const day = Math.min(Math.max(Math.round(input.payment_due_day), 1), 28);
    insertRow.payment_due_day = day;
  }

  const { data, error } = await supabase
    .from("students")
    .insert(insertRow)
    .select(
      "id, full_name, phone, student_code, status, created_at, start_date, payment_due_day",
    )
    .single();

  if (error) {
    if (error.message.includes("password_hash")) {
      throw new Error(
        "Нужна миграция БД: запусти supabase/MIGRATE_MINIMAL.sql в Supabase SQL Editor",
      );
    }
    throw new Error(error.message);
  }

  return {
    ...mapStudent(data as DbStudent),
    plain_password: plainPassword,
  };
}

export async function resetStudentPassword(
  studentId: string,
): Promise<{ student_code: string; plain_password: string; full_name: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const plainPassword = generatePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, 10);

  const { data, error } = await supabase
    .from("students")
    .update({ password_hash: passwordHash })
    .eq("id", studentId)
    .select("student_code, full_name")
    .single();

  if (error) throw new Error(error.message);

  return {
    student_code: data.student_code,
    plain_password: plainPassword,
    full_name: data.full_name,
  };
}

export async function loginStudent(code: string, password: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, phone, student_code, password_hash, status")
    .eq("student_code", code.trim().toUpperCase())
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.password_hash || !bcrypt.compareSync(password, data.password_hash)) {
    return null;
  }

  return mapStudent(data as DbStudent);
}