"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/mobile/MobileShell";

const TABS = [
  { id: "home", label: "Главная", icon: "🏠" },
  { id: "grades", label: "Оценки", icon: "📊" },
  { id: "attendance", label: "Визиты", icon: "📅" },
];

const statusLabel: Record<string, string> = {
  present: "✅ Присутствовал",
  absent: "❌ Отсутствовал",
  late: "⏰ Опоздал",
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState("home");
  const [data, setData] = useState<{
    student: { full_name: string; student_code: string };
    teachers: { teacher_name: string; group_name: string }[];
    grades: {
      title: string;
      score: number;
      max_score: number;
      teacher_name: string;
      graded_at: string;
    }[];
    attendance: {
      lesson_date: string;
      status: string;
      teacher_name: string;
    }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/student/me").then(async (res) => {
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
    router.push("/app");
  }

  if (!data) {
    return (
      <MobileShell title="Кабинет ученика" subtitle="Загрузка...">
        <p className="text-zinc-500">Загрузка...</p>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title="Кабинет ученика"
      subtitle={`${data.student.full_name} · ${data.student.student_code}`}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === "home" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Ваш код</p>
            <p className="font-mono text-lg font-semibold text-emerald-600">
              {data.student.student_code}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-zinc-900">Мои учителя</h2>
            {data.teachers.length === 0 ? (
              <p className="mt-3 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-500">
                Пока не назначены
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.teachers.map((t, i) => (
                  <li
                    key={i}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-semibold">{t.teacher_name}</p>
                    <p className="text-sm text-zinc-500">
                      Группа: {t.group_name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl border border-zinc-300 py-3.5 font-medium text-zinc-700"
          >
            Выйти
          </button>
        </section>
      )}

      {tab === "grades" && (
        <section>
          <h2 className="font-semibold text-zinc-900">Оценки</h2>
          {data.grades.length === 0 ? (
            <p className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-500">
              Пока нет оценок
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.grades.map((g, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"
                >
                  <p className="font-semibold text-zinc-900">{g.title}</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-600">
                    {g.score}
                    <span className="text-base font-normal text-zinc-500">
                      {" "}
                      / {g.max_score}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">{g.teacher_name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "attendance" && (
        <section>
          <h2 className="font-semibold text-zinc-900">Посещаемость</h2>
          {data.attendance.length === 0 ? (
            <p className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-500">
              Пока нет отметок
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.attendance.map((a, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-zinc-900">{a.lesson_date}</p>
                  <p className="mt-1 text-sm">
                    {statusLabel[a.status] ?? a.status}
                  </p>
                  <p className="text-sm text-zinc-500">{a.teacher_name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </MobileShell>
  );
}