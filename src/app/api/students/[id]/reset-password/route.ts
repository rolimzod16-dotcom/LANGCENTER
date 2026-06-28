import { NextRequest, NextResponse } from "next/server";
import { resetStudentPassword } from "@/lib/students";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await resetStudentPassword(id);
    return NextResponse.json({ credentials: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка сброса";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}