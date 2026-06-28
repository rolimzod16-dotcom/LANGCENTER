import { NextRequest, NextResponse } from "next/server";
import { createTeacher, listTeachers } from "@/lib/teachers";

export async function GET() {
  try {
    const teachers = await listTeachers();
    return NextResponse.json({ teachers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Имя и фамилия обязательны" },
        { status: 400 },
      );
    }

    const teacher = await createTeacher({
      first_name: firstName,
      last_name: lastName,
      email: body.email ? String(body.email) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      group_name: body.group_name ? String(body.group_name) : undefined,
    });

    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}