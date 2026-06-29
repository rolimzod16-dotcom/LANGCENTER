import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { StudentPayment } from "@/lib/payments";

export const TEACHER_SALARY_RATE = 0.5;

export type TeacherAssignment = {
  teacher_id: string;
  teacher_name: string;
  teacher_code: string;
};

export type TeacherPayrollRow = {
  teacher_id: string;
  teacher_name: string;
  teacher_code: string;
  student_count: number;
  course_total: number;
  salary: number;
};

export type TeacherPayrollSummary = {
  total_payroll: number;
  total_course_base: number;
  net_after_payroll: number;
  teachers: TeacherPayrollRow[];
};

export type PayrollBasis = "course" | "paid";

const UNASSIGNED_ID = "unassigned";

function payrollBase(payment: StudentPayment, basis: PayrollBasis): number {
  return basis === "paid" ? payment.amount_paid : payment.amount_due;
}

export async function getTeacherAssignmentsByStudentIds(
  studentIds: string[],
): Promise<Map<string, TeacherAssignment>> {
  const map = new Map<string, TeacherAssignment>();
  if (!studentIds.length) return map;

  const supabase = getSupabaseServerClient();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from("group_students")
    .select(
      "student_id, groups(teachers(id, full_name, teacher_code))",
    )
    .in("student_id", studentIds);

  if (error) return map;

  for (const row of data ?? []) {
    const g = row.groups as unknown as {
      teachers: {
        id: string;
        full_name: string;
        teacher_code: string;
      };
    } | null;
    if (g?.teachers?.id) {
      map.set(row.student_id, {
        teacher_id: g.teachers.id,
        teacher_name: g.teachers.full_name,
        teacher_code: g.teachers.teacher_code,
      });
    }
  }

  return map;
}

export async function buildTeacherPayrollReport(
  payments: StudentPayment[],
  basis: PayrollBasis,
  incomeForNet = 0,
): Promise<TeacherPayrollSummary> {
  const studentIds = [...new Set(payments.map((p) => p.student_id))];
  const assignments = await getTeacherAssignmentsByStudentIds(studentIds);

  const byTeacher = new Map<
    string,
    {
      teacher_name: string;
      teacher_code: string;
      student_count: number;
      course_total: number;
      salary: number;
    }
  >();

  for (const payment of payments) {
    const base = payrollBase(payment, basis);
    if (base <= 0 && basis === "paid") continue;

    const assignment = assignments.get(payment.student_id);
    const teacherId = assignment?.teacher_id ?? UNASSIGNED_ID;
    const teacherName = assignment?.teacher_name ?? "Без учителя";
    const teacherCode = assignment?.teacher_code ?? "—";

    const current = byTeacher.get(teacherId) ?? {
      teacher_name: teacherName,
      teacher_code: teacherCode,
      student_count: 0,
      course_total: 0,
      salary: 0,
    };

    current.student_count += 1;
    current.course_total += base;
    current.salary += Math.round(base * TEACHER_SALARY_RATE);
    byTeacher.set(teacherId, current);
  }

  const teachers: TeacherPayrollRow[] = [...byTeacher.entries()]
    .map(([teacher_id, row]) => ({
      teacher_id,
      teacher_name: row.teacher_name,
      teacher_code: row.teacher_code,
      student_count: row.student_count,
      course_total: Math.round(row.course_total),
      salary: row.salary,
    }))
    .sort((a, b) =>
      a.teacher_name.localeCompare(b.teacher_name, "ru"),
    );

  const total_payroll = teachers.reduce((sum, row) => sum + row.salary, 0);
  const total_course_base = teachers.reduce(
    (sum, row) => sum + row.course_total,
    0,
  );

  return {
    total_payroll,
    total_course_base,
    net_after_payroll: Math.round(incomeForNet - total_payroll),
    teachers,
  };
}

export function studentPayrollAmount(
  payment: StudentPayment,
  basis: PayrollBasis,
): number {
  return Math.round(payrollBase(payment, basis) * TEACHER_SALARY_RATE);
}