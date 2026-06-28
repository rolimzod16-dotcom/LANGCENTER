import { NextRequest, NextResponse } from "next/server";
import { resetTeacherPassword } from "@/lib/teachers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await resetTeacherPassword(id);
    return NextResponse.json({ credentials: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}