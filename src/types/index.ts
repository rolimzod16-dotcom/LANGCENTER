export type UserRole = "owner" | "admin" | "teacher" | "reception" | "student";

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  email?: string;
  phone?: string;
};

export type Group = {
  id: string;
  name: string;
  level?: string;
};

export type Grade = {
  id: string;
  studentId: string;
  title: string;
  score: number;
  maxScore: number;
};

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type AttendanceRecord = {
  id: string;
  studentId: string;
  lessonId: string;
  status: AttendanceStatus;
};