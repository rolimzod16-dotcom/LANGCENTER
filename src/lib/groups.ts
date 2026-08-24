import { getAdminOrgId, orgInsertFields } from "@/lib/org";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function listGroupsForTeacher(
  teacherId: string,
): Promise<GroupRow[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const { data, error } = await supabase
    .from("groups")
    .select("id, name, level, teacher_id, created_at")
    .eq("teacher_id", teacherId)
    .order("name", { ascending: true });

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
};

/** «Утро 09:00, Вечер 18:30» / с новой строки → список смен */
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

export async function createGroupForTeacher(input: {
  teacher_id: string;
  name: string;
  level?: string;
  organization_id?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase не настроен");

  const name = input.name.trim();
  if (!name) throw new Error("Название смены обязательно");

  const { data: existing } = await supabase
    .from("groups")
    .select("id, name, level, teacher_id, created_at")
    .eq("teacher_id", input.teacher_id)
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing as GroupRow;

  const orgFields = await orgInsertFields(
    input.organization_id ?? (await getAdminOrgId()),
  );

  const base = {
    teacher_id: input.teacher_id,
    name,
    level: input.level?.trim() || null,
  };

  let { data, error } = await supabase
    .from("groups")
    .insert({ ...base, ...orgFields })
    .select("id, name, level, teacher_id, created_at")
    .single();

  // organization_id column may not exist
  if (error?.message.toLowerCase().includes("organization_id")) {
    const retry = await supabase
      .from("groups")
      .insert(base)
      .select("id, name, level, teacher_id, created_at")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  return data! as GroupRow;
}

export async function createShiftsForTeacher(
  teacherId: string,
  names: string[],
  organizationId?: string | null,
) {
  const unique = parseShiftNames(names.join(", "));
  const list = unique.length ? unique : ["Основная смена"];
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
      name: "Основная смена",
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
    .select("id, name")
    .eq("teacher_id", teacherId)
    .order("name", { ascending: true });

  if (gErr) throw new Error(gErr.message);
  if (!groups?.length) return [];

  const groupById = new Map(groups.map((g) => [g.id, g.name]));
  const groupIds = groups.map((g) => g.id);

  const { data, error } = await supabase
    .from("group_students")
    .select("group_id, student_id, students(id, full_name, student_code, phone)")
    .in("group_id", groupIds);

  if (error) throw new Error(error.message);

  const byStudent = new Map<
    string,
    {
      id: string;
      full_name: string;
      student_code: string;
      phone: string | null;
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

