"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    student: { full_name: string; student_code: string };
    teachers: { teacher_name: string; group_name: string }[];
    grades: { title: string; score: number; max_score: number; teacher_name: string; graded_at: string }[];
    attendance: { lesson_date: string; status: string; teacher_name: string }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/student/me")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          router.push("/student/login");
          return;
        }
        setData(json);
      });
  }, [router]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/student/login");
  }

  if (!data) {
    return (
      <AppShell title="Кабинет ученика" subtitle="Загрузка...">
        <p className="text-zinc-500">Загрузка...</p>
      </AppShell>
    );
  }

  const statusLabel: Record<string, string> = {
    present: "Присутствовал",
    absent: "Отсутствовал",
    late: "Опоздал",
  };

  return (
    <AppShell
      title="Кабинет ученика"
      subtitle={`${data.student.full_name} · ${data.student.student_code}`}
    >
      <button
        onClick={logout}
        className="mb-6 text-sm text-zinc-500 hover:text-zinc-800"
      >
        Выйти
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Мои учителя</h2>
          {data.teachers.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Пока не назначены</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.teachers.map((t, i) => (
                <li key={i} className="rounded-lg bg-zinc-50 p-3">
                  <p className="font-medium">{t.teacher_name}</p>
                  <p className="text-zinc-500">Группа: {t.group_name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Оценки</h2>
          {data.grades.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Пока нет оценок</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.grades.map((g, i) => (
                <li key={i} className="rounded-lg bg-indigo-50 p-3">
                  <p className="font-medium">{g.title}</p>
                  <p className="text-indigo-700">
                    {g.score} / {g.max_score} — {g.teacher_name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Посещаемость</h2>
          {data.attendance.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Пока нет отметок</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.attendance.map((a, i) => (
                <li key={i} className="rounded-lg bg-zinc-50 p-3">
                  <p>{a.lesson_date}</p>
                  <p>
                    {statusLabel[a.status] ?? a.status} — {a.teacher_name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}