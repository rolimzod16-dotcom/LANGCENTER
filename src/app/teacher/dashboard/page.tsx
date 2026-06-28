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
      {error && <p className="lc-alert lc-alert-error mb-4">{error}</p>}
      {success && <p className="lc-alert lc-alert-success mb-4">{success}</p>}

      {tab === "students" && (
        <section>
          <h2 className="text-lg font-bold text-slate-900">
            Мои ученики ({students.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Нажмите кнопку — отметка за сегодня
          </p>
          {students.length === 0 ? (
            <p className="lc-card-flat mt-6 p-4 text-center text-sm text-slate-500">
              Пока нет учеников. Админ добавит их в панели управления.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="lc-card p-4"
                >
                  <p className="font-bold text-slate-900">{s.full_name}</p>
                  <p className="font-mono text-sm text-indigo-600">
                    {s.student_code}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => mark(s.id, "present")}
                      className="lc-btn rounded-xl bg-emerald-100 py-3 text-sm font-semibold text-emerald-800"
                    >
                      ✅ Пришёл
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(s.id, "late")}
                      className="lc-btn rounded-xl bg-amber-100 py-3 text-sm font-semibold text-amber-800"
                    >
                      ⏰ Опоздал
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(s.id, "absent")}
                      className="lc-btn rounded-xl bg-red-100 py-3 text-sm font-semibold text-red-800"
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
          <h2 className="text-lg font-bold text-slate-900">Выставить балл</h2>
          <form onSubmit={submitGrade} className="lc-card mt-4 space-y-3 p-4">
            <select
              required
              value={gradeForm.student_id}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, student_id: e.target.value }))
              }
              className="lc-input"
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
              className="lc-input"
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
              className="lc-input"
            />
            <input
              value={gradeForm.comment}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, comment: e.target.value }))
              }
              placeholder="Комментарий (необязательно)"
              className="lc-input"
            />
            <button
              type="submit"
              className="lc-btn lc-btn-primary w-full py-3.5"
            >
              Сохранить оценку
            </button>
          </form>
        </section>
      )}

      {tab === "profile" && (
        <section className="space-y-4">
          <div className="lc-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Имя
            </p>
            <p className="mt-1 text-lg font-bold">{teacher?.full_name ?? "—"}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Код
            </p>
            <p className="mt-1 font-mono text-indigo-600">
              {teacher?.teacher_code ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="lc-btn lc-btn-ghost w-full py-3.5"
          >
            Выйти
          </button>
        </section>
      )}
    </MobileShell>
  );
}