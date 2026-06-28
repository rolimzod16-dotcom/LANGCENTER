import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStudentAttendance } from "@/lib/attendance";
import { getStudentGrades } from "@/lib/grades";
import { getStudentTeachers } from "@/lib/groups";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "student") {
      return NextResponse.json({ error: "Войди как ученик" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const { data: student } = await supabase!
      .from("students")
      .select("id, full_name, student_code")
      .eq("id", session.id)
      .single();

    const [teachers, grades, attendance] = await Promise.all([
      getStudentTeachers(session.id),
      getStudentGrades(session.id),
      getStudentAttendance(session.id),
    ]);

    return NextResponse.json({ student, teachers, grades, attendance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}