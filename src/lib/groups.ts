import { getAdminOrgId, orgInsertFields } from "@/lib/org";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function listGroupsForTeacher(
  teacherId: string,
): Promise<GroupRow[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  let query = supabase
    .from("groups")
    .select("id, name, level, teacher_id, created_at, lesson_time")
    .eq("teacher_id", teacherId)
    .order("lesson_time", { ascending: true, nullsFirst: false });

  let { data, error } = await query;
  if (error?.message.toLowerCase().includes("lesson_time")) {
    const fallback = await supabase
      .from("groups")
      .select("id, name, level, teacher_id, created_at")
      .eq("teacher_id", teacherId)
      .order("name", { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  return (data ?? []) as GroupRow[];
}

export async function listAllGroups(orgId?: string | null) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const resolvedOrg = orgId === undefined ? await getAdminOrgId() : orgId;
  let query = supabase
    .from("groups")
    .select("id, name, level, teacher_id, teachers(full_name, teacher_code)")
    .order("name", { ascending: true });

  if (resolvedOrg) {
    query = query.eq("organization_id", resolvedOrg);
  }

  const { data, error } = await query;
  if (error) {
    // fallback without org column
    if (error.message.toLowerCase().includes("organization_id")) {
      const fallback = await supabase
        .from("groups")
        .select("id, name, level, teacher_id, teachers(full_name, teacher_code)")
        .order("name", { ascending: true });
      if (fallback.error) throw new Error(fallback.error.message);
      return fallback.data ?? [];
    }
    throw new Error(error.message);
  }
  return data ?? [];
}

export type GroupRow = {
  id: string;
  name: string;
  level: string | null;
  teacher_id: string | null;
  created_at?: string;
  lesson_time?: string | null;
};

export function formatLessonTime(value?: string | null): string {
  if (!value) return "";
  return String(value).slice(0, 5);
}

export function formatShiftLabel(g: {
  name?: string | null;
  lesson_time?: string | null;
}): string {
  const time = formatLessonTime(g.lesson_time);
  const name = (g.name || "").trim();
  if (time && name) return `${time} · ${name}`;
  return time || name || "Смена";
}

export function numberedShiftName(n: number) {
  return `Смена ${n}`;
}

export function nextShiftNumber(existing: { name?: string | null }[]): number {
  let max = 0;
  for (const g of existing) {
    const m = String(g.name || "").match(/^смена\s+(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Math.max(max, existing.length) + 1;
}

/** 9:00 / 18.30 / 18:00, 14:30 → ["09:00", "18:30", ...] */
export function parseLessonTimes(raw?: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n]+/)) {
    const m = part.trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m) continue;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) continue;
    const t = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Список названий / с новой строки */
export function parseShiftNames(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of trimmed.split(/[,;\n]+/)) {
    const name = part.trim().replace(/\s+/g, " ");
    if (name.length < 1) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

const GROUP_SELECT = "id, name, level, teacher_id, created_at, lesson_time";

export async function createGroupForTeacher(input: {
  teacher_id: string;
  name: string;
  level?: string;
  lesson_time?: string | null;
  organization_id?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const name = input.name.trim();
  if (!name) throw new Error("Название смены обязательно");
  const lessonTime = input.lesson_time
    ? formatLessonTime(input.lesson_time) || null
    : null;

  if (lessonTime) {
    const { data: byTime } = await supabase
      .from("groups")
      .select(GROUP_SELECT)
      .eq("teacher_id", input.teacher_id)
      .eq("lesson_time", lessonTime)
      .maybeSingle();
    if (byTime) return byTime as GroupRow;
  }

  const { data: existing } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .eq("teacher_id", input.teacher_id)
    .ilike("name", name)
    .maybeSingle();
  if (existing) {
    if (lessonTime && !existing.lesson_time) {
      await supabase
        .from("groups")
        .update({ lesson_time: lessonTime })
        .eq("id", existing.id);
      return { ...existing, lesson_time: lessonTime } as GroupRow;
    }
    return existing as GroupRow;
  }

  const orgFields = await orgInsertFields(
    input.organization_id ?? (await getAdminOrgId()),
  );

  const base: Record<string, unknown> = {
    teacher_id: input.teacher_id,
    name,
    level: input.level?.trim() || null,
    lesson_time: lessonTime,
  };

  let { data, error } = await supabase
    .from("groups")
    .insert({ ...base, ...orgFields })
    .select(GROUP_SELECT)
    .single();

  if (error?.message.toLowerCase().includes("lesson_time")) {
    delete base.lesson_time;
    const retry = await supabase
      .from("groups")
      .insert({ ...base, ...orgFields })
      .select("id, name, level, teacher_id, created_at")
      .single();
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error?.message.toLowerCase().includes("organization_id")) {
    const retry = await supabase
      .from("groups")
      .insert(base)
      .select(GROUP_SELECT)
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  return data! as GroupRow;
}

export async function createShiftsFromTimes(
  teacherId: string,
  times: string[],
  organizationId?: string | null,
) {
  const existing = await listGroupsForTeacher(teacherId);
  let next = nextShiftNumber(existing);
  const created: GroupRow[] = [];
  for (const raw of times) {
    const time = formatLessonTime(raw);
    if (!time) continue;
    const already = existing.find((g) => formatLessonTime(g.lesson_time) === time);
    if (already) {
      created.push(already);
      continue;
    }
    const row = await createGroupForTeacher({
      teacher_id: teacherId,
      name: numberedShiftName(next),
      lesson_time: time,
      organization_id: organizationId,
    });
    next += 1;
    existing.push(row);
    created.push(row);
  }
  return created;
}

export async function createShiftsForTeacher(
  teacherId: string,
  names: string[],
  organizationId?: string | null,
) {
  const joined = names.join(", ");
  const times = parseLessonTimes(joined);
  if (times.length) {
    return createShiftsFromTimes(teacherId, times, organizationId);
  }
  const unique = parseShiftNames(joined);
  const list = unique.length ? unique : [numberedShiftName(1)];
  const created: GroupRow[] = [];
  for (const name of list) {
    created.push(
      await createGroupForTeacher({
        teacher_id: teacherId,
        name,
        organization_id: organizationId,
      }),
    );
  }
  return created;
}

export async function assignStudentToGroup(studentId: string, groupId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { error } = await supabase.from("group_students").upsert(
    { group_id: groupId, student_id: studentId },
    { onConflict: "group_id,student_id" },
  );

  if (error) throw new Error(error.message);
  return { group_id: groupId };
}

export async function assignStudentToTeacher(
  studentId: string,
  teacherId: string,
  groupId?: string | string[],
) {
  const requested = (Array.isArray(groupId) ? groupId : groupId ? [groupId] : [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  const groups = await listGroupsForTeacher(teacherId);
  let available = groups;
  if (!available.length) {
    const created = await createGroupForTeacher({
      teacher_id: teacherId,
      name: numberedShiftName(1),
    });
    available = [created];
  }

  let targets: string[];
  if (requested.length) {
    const allowed = new Set(available.map((g) => g.id));
    targets = requested.filter((id) => allowed.has(id));
    if (!targets.length) {
      throw new Error("Смена не принадлежит этому учителю");
    }
  } else if (available.length === 1) {
    targets = [available[0]!.id];
  } else {
    throw new Error(
      "У учителя несколько смен — выберите одну или несколько",
    );
  }

  const assigned: string[] = [];
  for (const gid of targets) {
    await assignStudentToGroup(studentId, gid);
    assigned.push(gid);
  }
  return { group_id: assigned[0]!, group_ids: assigned };
}

/** Ученик закреплён за этим учителем (через любую его группу). */
export async function isStudentAssignedToTeacher(
  studentId: string,
  teacherId: string,
): Promise<boolean> {
  const ids = await getStudentIdsForTeacher(teacherId);
  return ids.includes(studentId);
}

export async function assertStudentAssignedToTeacher(
  studentId: string,
  teacherId: string,
) {
  const ok = await isStudentAssignedToTeacher(studentId, teacherId);
  if (!ok) {
    throw new Error("Этот ученик не в ваших группах");
  }
}

export async function getTeacherNamesByStudentIds(
  studentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!studentIds.length) return map;

  const supabase = getSupabaseServerClient();
  if (!supabase) return map;

  // Chunk IN queries for large lists
  const chunkSize = 200;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("group_students")
      .select("student_id, groups(name, teachers(full_name))")
      .in("student_id", chunk);

    if (error) continue;

    for (const row of data ?? []) {
      const g = row.groups as unknown as {
        name?: string;
        teachers: { full_name: string } | null;
      } | null;
      if (g?.teachers?.full_name) {
        const existing = map.get(row.student_id);
        if (existing && !existing.includes(g.teachers.full_name)) {
          map.set(row.student_id, `${existing}, ${g.teachers.full_name}`);
        } else if (!existing) {
          map.set(row.student_id, g.teachers.full_name);
        }
      }
    }
  }

  return map;
}

export async function getStudentIdsForTeacher(teacherId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("id")
    .eq("teacher_id", teacherId);

  if (gErr) throw new Error(gErr.message);
  if (!groups?.length) return [];

  const { data: links, error } = await supabase
    .from("group_students")
    .select("student_id")
    .in(
      "group_id",
      groups.map((g) => g.id),
    );

  if (error) throw new Error(error.message);
  return [...new Set((links ?? []).map((l) => l.student_id))];
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
    .select("id, name, lesson_time")
    .eq("teacher_id", teacherId)
    .order("lesson_time", { ascending: true });

  if (gErr) throw new Error(gErr.message);
  if (!groups?.length) return [];

  const groupById = new Map(
    groups.map((g) => [g.id, formatShiftLabel(g)]),
  );
  const groupIds = groups.map((g) => g.id);

  const { data, error } = await supabase
    .from("group_students")
    .select(
      "group_id, student_id, students(id, full_name, student_code, phone, telegram_username, telegram_chat_id)",
    )
    .in("group_id", groupIds);

  if (error) {
    const retry = await supabase
      .from("group_students")
      .select("group_id, student_id, students(id, full_name, student_code, phone)")
      .in("group_id", groupIds);
    if (retry.error) throw new Error(error.message);
    const mapped = (retry.data ?? []).map((row) => ({
      ...row,
      students: row.students
        ? { ...(row.students as object), telegram_username: null }
        : null,
    }));
    return mapTeacherStudents(mapped, groupById);
  }

  return mapTeacherStudents(data ?? [], groupById);
}

function mapTeacherStudents(
  data: Array<{ group_id: string; students: unknown }>,
  groupById: Map<string, string>,
) {
  const byStudent = new Map<
    string,
    {
      id: string;
      full_name: string;
      student_code: string;
      phone: string | null;
      telegram_username: string | null;
      group_name: string;
      group_names: string[];
    }
  >();

  for (const row of data ?? []) {
    const s = row.students as unknown as {
      id: string;
      full_name: string;
      student_code: string;
      phone: string | null;
      telegram_username?: string | null;
    } | null;
    if (!s?.id) continue;

    const gName = groupById.get(row.group_id) ?? "";
    const existing = byStudent.get(s.id);
    if (existing) {
      if (gName && !existing.group_names.includes(gName)) {
        existing.group_names.push(gName);
        existing.group_name = existing.group_names.join(", ");
      }
    } else {
      byStudent.set(s.id, {
        id: s.id,
        full_name: s.full_name,
        student_code: s.student_code,
        phone: s.phone,
        telegram_username: s.telegram_username ?? null,
        group_name: gName,
        group_names: gName ? [gName] : [],
      });
    }
  }

  return [...byStudent.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "ru"),
  );
}

export async function getStudentTeachers(studentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("group_students")
    .select(
      "group_id, groups(id, name, lesson_time, teachers(id, full_name, teacher_code, phone, telegram_username))",
    )
    .eq("student_id", studentId);

  if (error) {
    if (error.message.toLowerCase().includes("lesson_time") || error.message.toLowerCase().includes("telegram_username")) {
      const retry = await supabase
        .from("group_students")
        .select("group_id, groups(id, name, teachers(id, full_name, teacher_code, phone))")
        .eq("student_id", studentId);
      if (retry.error) throw new Error(retry.error.message);
      return (retry.data ?? []).map((row) => {
        const g = row.groups as unknown as {
          id: string;
          name: string;
          teachers: {
            id: string;
            full_name: string;
            teacher_code: string;
            phone?: string | null;
          };
        };
        return {
          group_id: g.id,
          group_name: g.name,
          lesson_time: null as string | null,
          teacher_id: g.teachers.id,
          teacher_name: g.teachers.full_name,
          teacher_code: g.teachers.teacher_code,
          teacher_phone: g.teachers.phone ?? null,
          telegram_username: null as string | null,
        };
      });
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const g = row.groups as unknown as {
      id: string;
      name: string;
      lesson_time?: string | null;
      teachers: {
        id: string;
        full_name: string;
        teacher_code: string;
        phone?: string | null;
        telegram_username?: string | null;
      };
    };
    return {
      group_id: g.id,
      group_name: formatShiftLabel({ name: g.name, lesson_time: g.lesson_time }),
      lesson_time: g.lesson_time ?? null,
      teacher_id: g.teachers.id,
      teacher_name: g.teachers.full_name,
      teacher_code: g.teachers.teacher_code,
      teacher_phone: g.teachers.phone ?? null,
      telegram_username: g.teachers.telegram_username ?? null,
    };
  });
}

export async function ensureDefaultGroupForTeacher(
  teacherId: string,
  groupName: string,
  organizationId?: string | null,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data: existing } = await supabase
    .from("groups")
    .select("id")
    .eq("teacher_id", teacherId)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  return createGroupForTeacher({
    teacher_id: teacherId,
    name: groupName,
    organization_id: organizationId,
  });
}

export async function getStudentShiftNames(
  studentId: string,
): Promise<string[]> {
  const links = await getStudentTeachers(studentId);
  return [...new Set(links.map((l) => l.group_name).filter(Boolean))];
}

