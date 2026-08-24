import { NextRequest, NextResponse } from "next/server";
import {
  createShiftsForTeacher,
  listAllGroups,
  listGroupsForTeacher,
} from "@/lib/groups";
import { getAdminOrgId } from "@/lib/org";

export async function GET(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacher_id");
    if (teacherId) {
      const groups = await listGroupsForTeacher(teacherId);
      return NextResponse.json({ groups });
    }
    const groups = await listAllGroups(await getAdminOrgId());
    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const teacherId = String(body.teacher_id ?? "").trim();
    const names = Array.isArray(body.names)
      ? body.names.map((n: unknown) => String(n))
      : body.name
        ? [String(body.name)]
        : [];
    if (!teacherId || !names.length) {
      return NextResponse.json(
        { error: "teacher_id и name/names обязательны" },
        { status: 400 },
      );
    }

    const orgId = await getAdminOrgId();
    const groups = await createShiftsForTeacher(teacherId, names, orgId);
    const group = groups[groups.length - 1];

    return NextResponse.json({ group, groups }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
