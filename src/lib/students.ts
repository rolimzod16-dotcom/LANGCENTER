import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { getStudentIdsForTeacher } from "@/lib/groups";
import {
  displayName,
  isSchemaColumnError,
  mapRawStudent,
  STUDENT_SELECT_ATTEMPTS,
  STUDENT_SELECT_LEGACY,
  STUDENT_SELECT_MODERN,
  type RawStudentRow,
  type StudentSchemaMode,
} from "@/lib/student-schema";
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

export type StudentListStatus = "all" | "active" | "inactive";

export type StudentsListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  teacher_id?: string;
  status?: StudentListStatus;
  student_ids?: string[];
};

export type StudentsSummary = {
  total: number;
  active: number;
};

export type PaginatedStudents = {
  students: StudentRow[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

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

export async function fetchAllStudentsRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
) {
  let lastError = "Не удалось прочитать таблицу students";

  for (const attempt of STUDENT_SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from("students")
      .select(attempt.select)
      .order(attempt.schema === "modern" ? "full_name" : "last_name", {
        ascending: true,
      });

    if (!error) {
      return {
        rows: (data ?? []) as unknown as RawStudentRow[],
        schema: attempt.schema,
      };
    }

    lastError = error.message;
    if (!isSchemaColumnError(error.message)) {
      throw new Error(error.message);
    }
  }

  throw new Error(lastError);
}

function applyStudentFilters(
  rows: RawStudentRow[],
  schema: StudentSchemaMode,
  query: StudentsListQuery,
  allowedIds: Set<string> | null,
) {
  const search = query.search?.trim().toLowerCase() ?? "";
  const status = query.status ?? "all";

  return rows.filter((row) => {
    const student = mapRawStudent(row, schema);

    if (allowedIds && !allowedIds.has(student.id)) {
      return false;
    }

    if (status === "active" && !student.is_active) return false;
    if (status === "inactive" && student.is_active) return false;

    if (!search) return true;
    const haystack = [
      displayName(student),
      student.student_code,
      student.phone ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

export async function getStudentsSummary(): Promise<StudentsSummary> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен. Проверь .env.local");

  const { rows, schema } = await fetchAllStudentsRows(supabase);
  const students = rows.map((row) => mapRawStudent(row, schema));
  return {
    total: students.length,
    active: students.filter((s) => s.is_active).length,
  };
}

export async function listStudentsPage(
  query: StudentsListQuery = {},
): Promise<PaginatedStudents> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен. Проверь .env.local");

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);

  let allowedIds: Set<string> | null = null;

  if (query.teacher_id) {
    const ids = await getStudentIdsForTeacher(query.teacher_id);
    allowedIds = new Set(ids);
    if (allowedIds.size === 0) {
      return { students: [], total: 0, page: 1, limit, total_pages: 1 };
    }
  }

  if (query.student_ids) {
    const paymentIds = new Set(query.student_ids);
    allowedIds = allowedIds
      ? new Set([...allowedIds].filter((id) => paymentIds.has(id)))
      : paymentIds;
    if (allowedIds.size === 0) {
      return { students: [], total: 0, page: 1, limit, total_pages: 1 };
    }
  }

  const { rows, schema } = await fetchAllStudentsRows(supabase);

  let filtered = applyStudentFilters(rows, schema, query, allowedIds);

  filtered.sort((a, b) =>
    displayName(mapRawStudent(a, schema)).localeCompare(
      displayName(mapRawStudent(b, schema)),
      "ru",
    ),
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const pageRows = filtered.slice(start, start + limit);

  return {
    students: pageRows.map((row) => mapRawStudent(row, schema)),
    total,
    page: safePage,
    limit,
    total_pages: totalPages,
  };
}

export async function listStudents(): Promise<StudentRow[]> {
  const { students } = await listStudentsPage({ page: 1, limit: 10_000 });
  return students;
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
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    phone: input.phone?.trim() || null,
    student_code: studentCode,
    password_hash: passwordHash,
    status: "active",
    is_active: true,
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

  let data: RawStudentRow | null = null;
  let schema: StudentSchemaMode = "modern";

  for (const modern of [true, false]) {
    const row: Record<string, unknown> = modern
      ? {
          full_name: fullName,
          phone: insertRow.phone,
          student_code: studentCode,
          password_hash: passwordHash,
          status: "active",
        }
      : {
          first_name: input.first_name.trim(),
          last_name: input.last_name.trim(),
          phone: insertRow.phone,
          student_code: studentCode,
          password_hash: passwordHash,
          is_active: true,
        };

    if (insertRow.monthly_fee !== undefined) row.monthly_fee = insertRow.monthly_fee;
    if (insertRow.start_date) row.start_date = insertRow.start_date;
    if (insertRow.payment_due_day !== undefined) {
      row.payment_due_day = insertRow.payment_due_day;
    }

    const select = modern ? STUDENT_SELECT_MODERN : STUDENT_SELECT_LEGACY;
    const { data: created, error } = await supabase
      .from("students")
      .insert(row)
      .select(select)
      .single();

    if (!error && created) {
      data = created as unknown as RawStudentRow;
      schema = modern ? "modern" : "legacy";
      break;
    }

    const msg = error?.message ?? "";
    if (error?.message?.includes("password_hash")) {
      throw new Error(
        "Нужна миграция БД: запусти supabase/FIX_SCHEMA_CLEAN.sql в Supabase SQL Editor",
      );
    }
    if (!isSchemaColumnError(msg) && !msg.includes("Could not find")) {
      throw new Error(msg);
    }
  }

  if (!data) {
    throw new Error("Не удалось создать ученика. Запусти supabase/FIX_SCHEMA_CLEAN.sql");
  }

  return {
    ...mapRawStudent(data, schema),
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

  for (const select of [
    "student_code, full_name",
    "student_code, first_name, last_name",
  ]) {
    const { data, error } = await supabase
      .from("students")
      .update({ password_hash: passwordHash })
      .eq("id", studentId)
      .select(select)
      .single();

    if (!error && data) {
      const row = data as unknown as {
        student_code: string;
        full_name?: string;
        first_name?: string;
        last_name?: string;
      };
      return {
        student_code: row.student_code,
        plain_password: plainPassword,
        full_name:
          row.full_name ??
          `${row.last_name ?? ""} ${row.first_name ?? ""}`.trim(),
      };
    }
    if (error && !isSchemaColumnError(error.message)) {
      throw new Error(error.message);
    }
  }

  throw new Error("Не удалось сбросить пароль");
}

export async function loginStudent(code: string, password: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  for (const modern of [true, false]) {
    const select = modern
      ? "id, full_name, phone, student_code, password_hash, status"
      : "id, first_name, last_name, phone, student_code, password_hash, is_active";

    let dbQuery = supabase
      .from("students")
      .select(select)
      .eq("student_code", code.trim().toUpperCase());

    dbQuery = modern
      ? dbQuery.eq("status", "active")
      : dbQuery.eq("is_active", true);

    const { data, error } = await dbQuery.maybeSingle();
    if (error && isSchemaColumnError(error.message)) continue;
    if (error) throw new Error(error.message);

    const row = data as unknown as RawStudentRow & { password_hash?: string };
    if (!row?.password_hash || !bcrypt.compareSync(password, row.password_hash)) {
      return null;
    }

    return mapRawStudent(row, modern ? "modern" : "legacy");
  }

  return null;
}