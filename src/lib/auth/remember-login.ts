const TEACHER_CODE_KEY = "lc_teacher_code";
const STUDENT_CODE_KEY = "lc_student_code";

export function readRememberedCode(role: "teacher" | "student"): string {
  if (typeof window === "undefined") return "";
  const key = role === "teacher" ? TEACHER_CODE_KEY : STUDENT_CODE_KEY;
  return localStorage.getItem(key) ?? "";
}

export function saveRememberedCode(role: "teacher" | "student", code: string) {
  if (typeof window === "undefined") return;
  const key = role === "teacher" ? TEACHER_CODE_KEY : STUDENT_CODE_KEY;
  localStorage.setItem(key, code.trim().toUpperCase());
}