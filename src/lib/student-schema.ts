import type { StudentRow } from "@/lib/students";

export type StudentSchemaMode = "modern" | "legacy";

export type RawStudentRow = {
  id: string;
  phone: string | null;
  student_code: string;
  created_at: string;
  full_name?: string | null;
  status?: string | null;
  start_date?: string | null;
  payment_due_day?: number | null;
  monthly_fee?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  is_active?: boolean | null;
};

export function isSchemaColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("full_name") ||
    lower.includes("status") ||
    lower.includes("start_date") ||
    lower.includes("payment_due_day") ||
    lower.includes("column") ||
    lower.includes("does not exist")
  );
}

export function mapRawStudent(row: RawStudentRow, mode: StudentSchemaMode): StudentRow {
  if (mode === "modern" && row.full_name) {
    const parts = row.full_name.trim().split(/\s+/);
    const last_name = parts.length > 1 ? parts[0] : "";
    const first_name = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? "";
    return {
      id: row.id,
      first_name,
      last_name,
      email: null,
      phone: row.phone,
      student_code: row.student_code,
      is_active: (row.status ?? "active") === "active",
      created_at: row.created_at,
      start_date: row.start_date ?? null,
      payment_due_day: row.payment_due_day ?? null,
    };
  }

  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: null,
    phone: row.phone,
    student_code: row.student_code,
    is_active: row.is_active ?? (row.status === "active"),
    created_at: row.created_at,
    start_date: row.start_date ?? null,
    payment_due_day: row.payment_due_day ?? null,
  };
}

export function displayName(student: StudentRow): string {
  return `${student.last_name} ${student.first_name}`.trim() || student.student_code;
}

export function escapeIlike(value: string): string {
  return value.replace(/[%_\\,]/g, (ch) => `\\${ch}`);
}

export const STUDENT_SELECT_MODERN =
  "id, full_name, phone, student_code, status, created_at, start_date, payment_due_day, monthly_fee";

export const STUDENT_SELECT_MODERN_MIN =
  "id, full_name, phone, student_code, status, created_at";

export const STUDENT_SELECT_LEGACY =
  "id, first_name, last_name, phone, student_code, is_active, created_at, monthly_fee";

export const STUDENT_SELECT_LEGACY_MIN =
  "id, first_name, last_name, phone, student_code, is_active, created_at";

export const STUDENT_SELECT_ATTEMPTS: Array<{
  select: string;
  schema: StudentSchemaMode;
}> = [
  { select: STUDENT_SELECT_MODERN, schema: "modern" },
  { select: STUDENT_SELECT_MODERN_MIN, schema: "modern" },
  { select: STUDENT_SELECT_LEGACY, schema: "legacy" },
  { select: STUDENT_SELECT_LEGACY_MIN, schema: "legacy" },
];