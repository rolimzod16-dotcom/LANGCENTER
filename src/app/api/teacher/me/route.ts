import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getTeacherStudents } from "@/lib/groups";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "Войди как учитель" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const { data: teacher } = await supabase!
      .from("teachers")
      .select("id, full_name, teacher_code")
      .eq("id", session.id)
      .single();

    const students = await getTeacherStudents(session.id);
    return NextResponse.json({ teacher, students });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}