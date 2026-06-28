"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

type Student = {
  id: string;
  full_name: string;
  student_code: string;
};

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<{ full_name: string; teacher_code: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");
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

  async function mark(studentId: string, status: "present" | "absent" | "late") {
    setError("");
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, status }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Ошибка");
  }

  async function submitGrade(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/teacher/login");
  }

  return (
    <AppShell
      title="Панель учителя"
      subtitle={teacher ? `${teacher.full_name} · ${teacher.teacher_code}` : "Загрузка..."}
    >
      <button
        onClick={logout}
        className="mb-6 text-sm text-zinc-500 hover:text-zinc-800"
      >
        Выйти
      </button>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Мои ученики ({students.length})</h2>
          {students.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              Пока нет учеников. Админ привяжет их в разделе «Привязка».
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-zinc-100 p-4"
                >
                  <p className="font-medium">{s.full_name}</p>
                  <p className="font-mono text-sm text-indigo-600">{s.student_code}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => mark(s.id, "present")}
                      className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                    >
                      ✅ Пришёл
                    </button>
                    <button
                      onClick={() => mark(s.id, "late")}
                      className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                    >
                      ⏰ Опоздал
                    </button>
                    <button
                      onClick={() => mark(s.id, "absent")}
                      className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-800"
                    >
                      ❌ Нет
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Выставить балл</h2>
          <form onSubmit={submitGrade} className="mt-4 space-y-3">
            <select
              required
              value={gradeForm.student_id}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, student_id: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">Выбери ученика</option>
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
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <input
              required
              type="number"
              min={0}
              max={100}
              value={gradeForm.score}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, score: e.target.value }))
              }
              placeholder="Балл (0-100)"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <input
              value={gradeForm.comment}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, comment: e.target.value }))
              }
              placeholder="Комментарий"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white"
            >
              Сохранить оценку
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}