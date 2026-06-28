"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/mobile/MobileShell";

type Student = {
  id: string;
  full_name: string;
  student_code: string;
};

const TABS = [
  { id: "students", label: "Ученики", icon: "👥" },
  { id: "grades", label: "Оценки", icon: "📝" },
  { id: "profile", label: "Профиль", icon: "👤" },
];

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState("students");
  const [teacher, setTeacher] = useState<{
    full_name: string;
    teacher_code: string;
  } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [gradeForm, setGradeForm] = useState({
    student_id: "",
    title: "Урок",
    score: "",
    comment: "",
  });

  async function load() {
    const res = await fetch("/api/teacher/me");
    const data = await res.json();
    if (!res.ok) {
      router.push("/teacher/login");
      return;
    }
    setTeacher(data.teacher);
    setStudents(data.students);
    if (data.students[0] && !gradeForm.student_id) {
      setGradeForm((f) => ({ ...f, student_id: data.students[0].id }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function mark(
    studentId: string,
    status: "present" | "absent" | "late",
  ) {
    setError("");
    setSuccess("");
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    const labels = { present: "Пришёл", late: "Опоздал", absent: "Нет" };
    setSuccess(`Отмечено: ${labels[status]}`);
  }

  async function submitGrade(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...gradeForm,
        score: Number(gradeForm.score),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setGradeForm((f) => ({ ...f, score: "", comment: "" }));
    setSuccess("Оценка сохранена");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/app");
  }

  return (
    <MobileShell
      title="Кабинет учителя"
      subtitle={
        teacher ? `${teacher.full_name} · ${teacher.teacher_code}` : "Загрузка..."
      }
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </p>
      )}

      {tab === "students" && (
        <section>
          <h2 className="font-semibold text-zinc-900">
            Мои ученики ({students.length})
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Нажмите кнопку — отметка за сегодня
          </p>
          {students.length === 0 ? (
            <p className="mt-6 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-500">
              Пока нет учеников. Админ добавит их в панели управления.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-semibold text-zinc-900">{s.full_name}</p>
                  <p className="font-mono text-sm text-indigo-600">
                    {s.student_code}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => mark(s.id, "present")}
                      className="rounded-xl bg-emerald-100 py-3 text-sm font-medium text-emerald-800 active:scale-95"
                    >
                      ✅ Пришёл
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(s.id, "late")}
                      className="rounded-xl bg-amber-100 py-3 text-sm font-medium text-amber-800 active:scale-95"
                    >
                      ⏰ Опоздал
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(s.id, "absent")}
                      className="rounded-xl bg-red-100 py-3 text-sm font-medium text-red-800 active:scale-95"
                    >
                      ❌ Нет
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "grades" && (
        <section>
          <h2 className="font-semibold text-zinc-900">Выставить балл</h2>
          <form onSubmit={submitGrade} className="mt-4 space-y-3">
            <select
              required
              value={gradeForm.student_id}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, student_id: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
            >
              <option value="">Выберите ученика</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <input
              value={gradeForm.title}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Название (Урок, ДЗ, Тест)"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
            />
            <input
              required
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={gradeForm.score}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, score: e.target.value }))
              }
              placeholder="Балл (0–100)"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
            />
            <input
              value={gradeForm.comment}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, comment: e.target.value }))
              }
              placeholder="Комментарий (необязательно)"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-3.5 font-semibold text-white"
            >
              Сохранить оценку
            </button>
          </form>
        </section>
      )}

      {tab === "profile" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Имя</p>
            <p className="text-lg font-semibold">{teacher?.full_name ?? "—"}</p>
            <p className="mt-3 text-sm text-zinc-500">Код</p>
            <p className="font-mono text-indigo-600">
              {teacher?.teacher_code ?? "—"}
            </p>
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
    </MobileShell>
  );
}