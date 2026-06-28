import { NextRequest, NextResponse } from "next/server";
import {
  assignStudentToTeacher,
  getTeacherNamesByStudentIds,
} from "@/lib/groups";
import { ensureStudentPaymentForMonth } from "@/lib/payments";
import {
  createStudent,
  getStudentsSummary,
  listStudentsPage,
  type StudentListStatus,
} from "@/lib/students";

const STATUSES = new Set<StudentListStatus>(["all", "active", "inactive"]);

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const summaryOnly = params.get("summary_only") === "1";
    const page = Number(params.get("page") ?? "1");
    const limit = Number(params.get("limit") ?? "50");
    const search = params.get("search") ?? "";
    const teacherId = params.get("teacher_id") ?? "";
    const statusParam = params.get("status") ?? "all";
    const status = STATUSES.has(statusParam as StudentListStatus)
      ? (statusParam as StudentListStatus)
      : "all";

    if (summaryOnly) {
      const summary = await getStudentsSummary();
      return NextResponse.json({ summary });
    }

    const result = await listStudentsPage({
      page,
      limit,
      search,
      teacher_id: teacherId || undefined,
      status,
    });

    const teacherNames = await getTeacherNamesByStudentIds(
      result.students.map((s) => s.id),
    );

    const enriched = result.students.map((s) => ({
      ...s,
      teacher_name: teacherNames.get(s.id) ?? null,
    }));

    const summary = await getStudentsSummary();

    return NextResponse.json({
      students: enriched,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        total_pages: result.total_pages,
      },
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const teacherId = String(body.teacher_id ?? "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Имя и фамилия обязательны" },
        { status: 400 },
      );
    }

    if (!teacherId) {
      return NextResponse.json(
        { error: "Сначала выбери учителя" },
        { status: 400 },
      );
    }

    const monthlyFee = body.monthly_fee ? Number(body.monthly_fee) : undefined;
    const startDate = body.start_date
      ? String(body.start_date).slice(0, 10)
      : undefined;
    const paymentDueDay = body.payment_due_day
      ? Number(body.payment_due_day)
      : undefined;

    const student = await createStudent({
      first_name: firstName,
      last_name: lastName,
      email: body.email ? String(body.email) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      monthly_fee: monthlyFee,
      start_date: startDate,
      payment_due_day: paymentDueDay,
    });

    await assignStudentToTeacher(student.id, teacherId);

    try {
      await ensureStudentPaymentForMonth(student.id);
    } catch {
      // payment table may not exist yet — student still created
    }

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка создания";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}