import { NextRequest, NextResponse } from "next/server";
import {
  createGroupForTeacher,
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
    const name = String(body.name ?? "").trim();
    if (!teacherId || !name) {
      return NextResponse.json(
        { error: "teacher_id и name обязательны" },
        { status: 400 },
      );
    }

    const group = await createGroupForTeacher({
      teacher_id: teacherId,
      name,
      level: body.level ? String(body.level) : undefined,
      organization_id: await getAdminOrgId(),
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
