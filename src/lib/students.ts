import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { getStudentIdsForTeacher } from "@/lib/groups";
import { getAdminOrgId, orgInsertFields } from "@/lib/org";
import { normalizePhoneInput, phoneDigits } from "@/lib/phone";
import {
  displayName,
  escapeIlike,
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
  /** Логин для входа (student_code) */
  student_code: string;
  is_active: boolean;
  created_at: string;
  start_date: string | null;
  payment_due_day: number | null;
  organization_id?: string | null;
  /** Виден только админу; хранится для восстановления */
  password_plain?: string | null;
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
  organization_id?: string | null;
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

/** Полная выборка — только для отчётов/merge платежей (с org-фильтром). */
export async function fetchAllStudentsRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  organizationId?: string | null,
) {
  let lastError = "Не удалось прочитать таблицу students";
  const orgId =
    organizationId === undefined ? await getAdminOrgId() : organizationId;

  for (const attempt of STUDENT_SELECT_ATTEMPTS) {
    let query = supabase.from("students").select(attempt.select);

    if (orgId) {
      query = query.eq("organization_id", orgId);
    }

    query = query.order(
      attempt.schema === "modern" ? "full_name" : "last_name",
      { ascending: true },
    );

    // Supabase default max 1000 — paginate through all
    const all: RawStudentRow[] = [];
    const pageSize = 1000;
    let from = 0;
    let schema = attempt.schema;
    let ok = false;

    while (true) {
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) {
        lastError = error.message;
        if (
          orgId &&
          error.message.toLowerCase().includes("organization_id")
        ) {
          // retry without org on this attempt
          const retry = await fetchAllStudentsRowsNoOrg(supabase, attempt);
          return retry;
        }
        if (!isSchemaColumnError(error.message)) {
          throw new Error(error.message);
        }
        ok = false;
        break;
      }
      ok = true;
      const rows = (data ?? []) as unknown as RawStudentRow[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    if (ok) {
      return { rows: all, schema };
    }
  }

  throw new Error(lastError);
}

async function fetchAllStudentsRowsNoOrg(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  attempt: (typeof STUDENT_SELECT_ATTEMPTS)[number],
) {
  const all: RawStudentRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("students")
      .select(attempt.select)
      .order(attempt.schema === "modern" ? "full_name" : "last_name", {
        ascending: true,
      })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as RawStudentRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return { rows: all, schema: attempt.schema };
}

export async function getStudentsSummary(
  organizationId?: string | null,
): Promise<StudentsSummary> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен. Проверь .env.local");

  const orgId =
    organizationId === undefined ? await getAdminOrgId() : organizationId;

  // Prefer SQL count
  for (const statusCol of ["status", "is_active"] as const) {
    let totalQ = supabase
      .from("students")
      .select("id", { count: "exact", head: true });
    let activeQ = supabase
      .from("students")
      .select("id", { count: "exact", head: true });

    if (orgId) {
      totalQ = totalQ.eq("organization_id", orgId);
      activeQ = activeQ.eq("organization_id", orgId);
    }

    if (statusCol === "status") {
      activeQ = activeQ.eq("status", "active");
    } else {
      activeQ = activeQ.eq("is_active", true);
    }

    const [totalRes, activeRes] = await Promise.all([totalQ, activeQ]);

    if (!totalRes.error && !activeRes.error) {
      return {
        total: totalRes.count ?? 0,
        active: activeRes.count ?? 0,
      };
    }

    if (
      totalRes.error &&
      !isSchemaColumnError(totalRes.error.message) &&
      !totalRes.error.message.toLowerCase().includes("organization_id")
    ) {
      // try without org
      if (orgId && totalRes.error.message.toLowerCase().includes("organization")) {
        continue;
      }
    }
  }

  // Fallback: full scan (legacy)
  const { rows, schema } = await fetchAllStudentsRows(supabase, orgId);
  const students = rows.map((row) => mapRawStudent(row, schema));
  return {
    total: students.length,
    active: students.filter((s) => s.is_active).length,
  };
}

/**
 * Список учеников с пагинацией на стороне БД (не грузим 500+ в RAM).
 */
export async function listStudentsPage(
  query: StudentsListQuery = {},
): Promise<PaginatedStudents> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен. Проверь .env.local");

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const orgId =
    query.organization_id === undefined
      ? await getAdminOrgId()
      : query.organization_id;

  let allowedIds: string[] | null = null;

  if (query.teacher_id) {
    allowedIds = await getStudentIdsForTeacher(query.teacher_id);
    if (allowedIds.length === 0) {
      return { students: [], total: 0, page: 1, limit, total_pages: 1 };
    }
  }

  if (query.student_ids) {
    const paymentIds = new Set(query.student_ids);
    allowedIds = allowedIds
      ? allowedIds.filter((id) => paymentIds.has(id))
      : [...paymentIds];
    if (allowedIds.length === 0) {
      return { students: [], total: 0, page: 1, limit, total_pages: 1 };
    }
  }

  // Too many IDs for .in() — fall back to in-memory path
  if (allowedIds && allowedIds.length > 400) {
    return listStudentsPageInMemory(query, orgId, allowedIds, page, limit);
  }

  const search = query.search?.trim() ?? "";
  const status = query.status ?? "all";

  for (const attempt of STUDENT_SELECT_ATTEMPTS) {
    let db = supabase
      .from("students")
      .select(attempt.select, { count: "exact" });

    if (orgId) {
      db = db.eq("organization_id", orgId);
    }

    if (status === "active") {
      db =
        attempt.schema === "modern"
          ? db.eq("status", "active")
          : db.eq("is_active", true);
    } else if (status === "inactive") {
      db =
        attempt.schema === "modern"
          ? db.neq("status", "active")
          : db.eq("is_active", false);
    }

    if (allowedIds) {
      db = db.in("id", allowedIds);
    }

    if (search) {
      db = applyStudentSearchFilter(db, search, attempt.schema);
    }

    const orderCol = attempt.schema === "modern" ? "full_name" : "last_name";
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await db
      .order(orderCol, { ascending: true })
      .range(from, to);

    if (error) {
      if (isSchemaColumnError(error.message)) continue;
      if (orgId && error.message.toLowerCase().includes("organization_id")) {
        return listStudentsPage({ ...query, organization_id: null });
      }
      // fallback in-memory
      return listStudentsPageInMemory(
        query,
        orgId,
        allowedIds,
        page,
        limit,
      );
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      students: ((data ?? []) as unknown as RawStudentRow[]).map((row) =>
        mapRawStudent(row, attempt.schema),
      ),
      total,
      page: Math.min(page, totalPages),
      limit,
      total_pages: totalPages,
    };
  }

  return listStudentsPageInMemory(query, orgId, allowedIds, page, limit);
}

/** Фильтр поиска: ФИО, код, телефон (как есть + только цифры). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStudentSearchFilter<T extends { or: (filter: string) => T }>(
  db: T,
  search: string,
  schema: StudentSchemaMode,
): T {
  const q = escapeIlike(search.trim());
  const digits = phoneDigits(search);
  const parts: string[] = [];

  if (schema === "modern") {
    parts.push(`full_name.ilike.%${q}%`);
  } else {
    parts.push(`first_name.ilike.%${q}%`);
    parts.push(`last_name.ilike.%${q}%`);
  }
  parts.push(`student_code.ilike.%${q}%`);
  parts.push(`phone.ilike.%${q}%`);

  // Поиск по цифрам телефона: 901234567 найдёт +998 90 123-45-67
  // и ВСЕХ учеников с этим номером (братья/сёстры)
  if (digits.length >= 4) {
    parts.push(`phone_digits.ilike.%${escapeIlike(digits)}%`);
    parts.push(`phone.ilike.%${escapeIlike(digits)}%`);
  }

  return db.or(parts.join(","));
}

function matchesStudentSearch(
  student: StudentRow,
  searchRaw: string,
  rawPhoneDigits?: string | null,
): boolean {
  const search = searchRaw.trim().toLowerCase();
  if (!search) return true;

  const digits = phoneDigits(searchRaw);
  const name = displayName(student).toLowerCase();
  const code = student.student_code.toLowerCase();
  const phone = (student.phone ?? "").toLowerCase();
  const pDigits = rawPhoneDigits ?? phoneDigits(student.phone);

  if (name.includes(search) || code.includes(search) || phone.includes(search)) {
    return true;
  }
  if (digits.length >= 4 && pDigits.includes(digits)) {
    return true;
  }
  // «как набрано» без пробелов/дефисов в phone
  if (digits.length >= 4 && phoneDigits(phone).includes(digits)) {
    return true;
  }
  return false;
}

async function listStudentsPageInMemory(
  query: StudentsListQuery,
  orgId: string | null,
  allowedIds: string[] | null,
  page: number,
  limit: number,
): Promise<PaginatedStudents> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { rows, schema } = await fetchAllStudentsRows(supabase, orgId);
  const search = query.search?.trim() ?? "";
  const status = query.status ?? "all";
  const allowed = allowedIds ? new Set(allowedIds) : null;

  let filtered = rows.filter((row) => {
    const student = mapRawStudent(row, schema);
    if (allowed && !allowed.has(student.id)) return false;
    if (status === "active" && !student.is_active) return false;
    if (status === "inactive" && student.is_active) return false;
    return matchesStudentSearch(student, search, row.phone_digits);
  });

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

export async function listStudents(
  organizationId?: string | null,
): Promise<StudentRow[]> {
  const { students } = await listStudentsPage({
    page: 1,
    limit: 100,
    organization_id: organizationId,
  });
  // For callers that need "all", use paginated fetch
  const summary = await getStudentsSummary(organizationId);
  if (summary.total <= 100) return students;

  const all: StudentRow[] = [];
  const pages = Math.ceil(summary.total / 100);
  for (let p = 1; p <= pages; p++) {
    const chunk = await listStudentsPage({
      page: p,
      limit: 100,
      organization_id: organizationId,
    });
    all.push(...chunk.students);
  }
  return all;
}

/** Логин ученика = student_code (верхний регистр). */
export function normalizeStudentLogin(login: string): string {
  return login.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidStudentLogin(login: string): boolean {
  return /^[A-Z0-9._@-]{3,32}$/.test(login);
}

export async function isStudentLoginTaken(
  login: string,
  supabase?: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
): Promise<boolean> {
  const db = supabase ?? getSupabaseServerClient();
  if (!db) throw new Error("Supabase не настроен. Проверь .env.local");
  const code = normalizeStudentLogin(login);
  const { data } = await db
    .from("students")
    .select("id")
    .eq("student_code", code)
    .maybeSingle();
  return Boolean(data);
}

export async function createStudent(input: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  monthly_fee?: number;
  start_date?: string;
  payment_due_day?: number;
  organization_id?: string | null;
  /** Свой логин (иначе генерируется STU-YYYY-XXXXXX) */
  student_code?: string;
  /** Свой пароль (иначе генерируется) */
  password?: string;
  /** Заметка для админа: курс, смена и т.п. */
  notes?: string;
}): Promise<CreateStudentResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен. Проверь .env.local");
  const db = supabase;

  let studentCode: string;
  if (input.student_code?.trim()) {
    studentCode = normalizeStudentLogin(input.student_code);
    if (!isValidStudentLogin(studentCode)) {
      throw new Error(
        "Логин: 3–32 символа (латиница, цифры, . _ @ -)",
      );
    }
    if (await isStudentLoginTaken(studentCode, db)) {
      throw new Error("Такой логин уже занят — выберите другой");
    }
  } else {
    studentCode = await generateUniqueCode(db);
  }

  const plainPassword = input.password?.trim()
    ? input.password.trim()
    : generatePassword();
  if (plainPassword.length < 6) {
    throw new Error("Пароль должен быть не короче 6 символов");
  }
  if (plainPassword.length > 72) {
    throw new Error("Пароль слишком длинный");
  }

  const passwordHash = bcrypt.hashSync(plainPassword, 10);
  const fullName = `${input.last_name.trim()} ${input.first_name.trim()}`.trim();
  const phone = normalizePhoneInput(input.phone);
  const digits = phoneDigits(phone);
  const orgId =
    input.organization_id === undefined
      ? await getAdminOrgId()
      : input.organization_id;
  // multi-org optional — orgInsertFields already no-ops if table missing
  const orgFields = await orgInsertFields(orgId);
  const notes = input.notes?.trim() || null;

  function missingColumn(message: string): string | null {
    const m =
      message.match(/Could not find the '([^']+)' column/i) ||
      message.match(/column (?:\w+\.)?(\w+) does not exist/i);
    return m?.[1] ?? null;
  }

  /** Insert с колонками, которые реально есть в текущей БД. */
  async function insertCore(
    base: Record<string, unknown>,
    select: string,
  ): Promise<{ data: RawStudentRow | null; error: string }> {
    const row = { ...base };
    for (let i = 0; i < 10; i++) {
      const { data, error } = await db
        .from("students")
        .insert(row)
        .select(select)
        .single();

      if (!error && data) {
        return { data: data as unknown as RawStudentRow, error: "" };
      }

      const msg = error?.message ?? "unknown";
      const lower = msg.toLowerCase();

      if (lower.includes("duplicate") || lower.includes("unique")) {
        if (lower.includes("student_code")) {
          throw new Error("Такой логин уже занят — выберите другой");
        }
        if (lower.includes("phone")) {
          throw new Error(
            "Телефон уже занят. Запусти supabase/UPGRADE_CREDENTIALS.sql",
          );
        }
        throw new Error(msg);
      }

      const miss = missingColumn(msg);
      if (miss && miss in row) {
        delete row[miss];
        continue;
      }

      // optional noise in message
      let stripped = false;
      for (const key of Object.keys(row)) {
        if (
          key !== "student_code" &&
          key !== "password_hash" &&
          key !== "full_name" &&
          key !== "first_name" &&
          key !== "last_name" &&
          key !== "status" &&
          key !== "is_active" &&
          lower.includes(key)
        ) {
          delete row[key];
          stripped = true;
        }
      }
      if (stripped) continue;

      return { data: null, error: msg };
    }
    return { data: null, error: "too many retries" };
  }

  // База под реальную схему (full_name/status/password_hash) — без optional-колонок
  const modernBase: Record<string, unknown> = {
    full_name: fullName,
    phone,
    student_code: studentCode,
    password_hash: passwordHash,
    status: "active",
  };
  if (input.monthly_fee !== undefined && input.monthly_fee > 0) {
    modernBase.monthly_fee = input.monthly_fee;
  }
  if (input.start_date) modernBase.start_date = input.start_date;
  if (input.payment_due_day !== undefined) {
    modernBase.payment_due_day = Math.min(
      Math.max(Math.round(input.payment_due_day), 1),
      28,
    );
  }
  // org только если multi-org реально есть
  Object.assign(modernBase, orgFields);

  let schema: StudentSchemaMode = "modern";
  let created = await insertCore(
    modernBase,
    "id, full_name, phone, student_code, status, created_at, start_date, payment_due_day, monthly_fee",
  );

  if (!created.data) {
    // legacy shape
    schema = "legacy";
    created = await insertCore(
      {
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        phone,
        student_code: studentCode,
        password_hash: passwordHash,
        is_active: true,
        ...(input.monthly_fee !== undefined && input.monthly_fee > 0
          ? { monthly_fee: input.monthly_fee }
          : {}),
        ...orgFields,
      },
      "id, first_name, last_name, phone, student_code, is_active, created_at",
    );
  }

  if (!created.data) {
    throw new Error(
      created.error
        ? `Не удалось создать ученика: ${created.error}`
        : "Не удалось создать ученика",
    );
  }

  // Best-effort extras (колонок может не быть, пока не запущен UPGRADE_CREDENTIALS.sql)
  const extras: Record<string, unknown> = {
    password_plain: plainPassword,
  };
  if (digits) extras.phone_digits = digits;
  if (notes) extras.notes = notes;

  let payload: Record<string, unknown> = { ...extras };
  for (let i = 0; i < 6 && Object.keys(payload).length > 0; i++) {
    const { error: extraErr } = await db
      .from("students")
      .update(payload)
      .eq("id", created.data.id);
    if (!extraErr) break;

    const miss = missingColumn(extraErr.message);
    if (miss && miss in payload) {
      delete payload[miss];
      continue;
    }
    const lower = extraErr.message.toLowerCase();
    let stripped = false;
    for (const key of Object.keys(payload)) {
      if (lower.includes(key)) {
        delete payload[key];
        stripped = true;
      }
    }
    if (!stripped) break;
  }

  return {
    ...mapRawStudent(created.data, schema),
    password_plain: plainPassword,
    plain_password: plainPassword,
    organization_id: orgId ?? null,
  };
}

export async function resetStudentPassword(
  studentId: string,
): Promise<{ student_code: string; plain_password: string; full_name: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const plainPassword = generatePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, 10);

  const updatePayload: Record<string, string> = {
    password_hash: passwordHash,
    password_plain: plainPassword,
  };

  for (const select of [
    "student_code, full_name, password_plain",
    "student_code, full_name",
    "student_code, first_name, last_name",
  ]) {
    let { data, error } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId)
      .select(select)
      .single();

    if (error?.message.toLowerCase().includes("password_plain")) {
      const retry = await supabase
        .from("students")
        .update({ password_hash: passwordHash })
        .eq("id", studentId)
        .select(select)
        .single();
      data = retry.data;
      error = retry.error;
    }

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

/**
 * Публичная регистрация ученика: сам задаёт логин и пароль.
 * Админ видит login + password_plain в списке учеников.
 */
export async function registerPublicStudent(input: {
  first_name: string;
  last_name: string;
  phone?: string;
  login: string;
  password: string;
  preferred_course?: string;
  preferred_schedule?: string;
}): Promise<CreateStudentResult> {
  const notesParts = [
    input.preferred_course ? `Курс: ${input.preferred_course}` : "",
    input.preferred_schedule ? `Смена: ${input.preferred_schedule}` : "",
    "Запись с сайта",
  ].filter(Boolean);

  // Без admin-сессии: филиал по умолчанию (или legacy без org)
  return createStudent({
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    student_code: input.login,
    password: input.password,
    notes: notesParts.join(" · "),
    organization_id: undefined,
    start_date: new Date().toISOString().slice(0, 10),
  });
}

export async function loginStudent(code: string, password: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const login = normalizeStudentLogin(code);
  if (!login || !password) return null;

  for (const modern of [true, false]) {
    const select = modern
      ? "id, full_name, phone, student_code, password_hash, status, organization_id"
      : "id, first_name, last_name, phone, student_code, password_hash, is_active, organization_id";

    let dbQuery = supabase
      .from("students")
      .select(select)
      .eq("student_code", login);

    dbQuery = modern
      ? dbQuery.eq("status", "active")
      : dbQuery.eq("is_active", true);

    const { data, error } = await dbQuery.maybeSingle();
    if (error && error.message.toLowerCase().includes("organization_id")) {
      // retry without org column
      const select2 = modern
        ? "id, full_name, phone, student_code, password_hash, status"
        : "id, first_name, last_name, phone, student_code, password_hash, is_active";
      let q2 = supabase
        .from("students")
        .select(select2)
        .eq("student_code", login);
      q2 = modern ? q2.eq("status", "active") : q2.eq("is_active", true);
      const retry = await q2.maybeSingle();
      if (retry.error && isSchemaColumnError(retry.error.message)) continue;
      if (retry.error) throw new Error(retry.error.message);
      const row = retry.data as unknown as RawStudentRow & {
        password_hash?: string;
      };
      if (
        !row?.password_hash ||
        !bcrypt.compareSync(password, row.password_hash)
      ) {
        return null;
      }
      return {
        ...mapRawStudent(row, modern ? "modern" : "legacy"),
        organization_id: null as string | null,
      };
    }
    if (error && isSchemaColumnError(error.message)) continue;
    if (error) throw new Error(error.message);

    const row = data as unknown as RawStudentRow & {
      password_hash?: string;
      organization_id?: string | null;
    };
    if (!row?.password_hash || !bcrypt.compareSync(password, row.password_hash)) {
      return null;
    }

    return {
      ...mapRawStudent(row, modern ? "modern" : "legacy"),
      organization_id: row.organization_id ?? null,
    };
  }

  return null;
}
