"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/mobile/MobileShell";

type Student = {
  id: string;
  full_name: string;
  student_code: string;
  group_name?: string;
  group_names?: string[];
  phone?: string | null;
  telegram_username?: string | null;
};

type AttendanceStatus = "present" | "absent" | "late";

const TABS = [
  { id: "students", label: "Ученики", icon: "👥" },
  { id: "grades", label: "Оценки", icon: "📝" },
  { id: "profile", label: "Профиль", icon: "👤" },
];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "✅ Пришёл",
  late: "⏰ Опоздал",
  absent: "❌ Нет",
};

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState("students");
  const [teacher, setTeacher] = useState<{
    full_name: string;
    teacher_code: string;
  } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [gradeForm, setGradeForm] = useState({
    student_id: "",
    title: "Урок",
    score: "",
    comment: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/teacher/me", { credentials: "same-origin" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      router.push("/teacher/login");
      return;
    }
    setTeacher(data.teacher);
    setStudents(data.students ?? []);
    setTodayAttendance(data.today_attendance ?? {});
    if (data.students?.[0] && !gradeForm.student_id) {
      setGradeForm((f) => ({ ...f, student_id: data.students[0].id }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shiftNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of students) {
      for (const n of s.group_names ?? (s.group_name ? [s.group_name] : [])) {
        if (n) names.add(n);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "ru"));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const names = s.group_names ?? (s.group_name ? [s.group_name] : []);
      if (shiftFilter !== "all" && !names.includes(shiftFilter)) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.student_code.toLowerCase().includes(q) ||
        names.some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [students, search, shiftFilter]);

  const markedToday = students.filter((s) => todayAttendance[s.id]).length;

  async function mark(
    studentId: string,
    status: AttendanceStatus,
  ) {
    setError("");
    setSuccess("");
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ student_id: studentId, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setTodayAttendance((prev) => ({ ...prev, [studentId]: status }));
    const labels = { present: "Пришёл", late: "Опоздал", absent: "Нет" };
    setSuccess(`Отмечено: ${labels[status]}`);
  }

  async function markAllPresent() {
    if (!students.length) return;
    setMarkingAll(true);
    setError("");
    setSuccess("");
    const ids = filteredStudents
      .filter((s) => todayAttendance[s.id] !== "present")
      .map((s) => s.id);
    if (ids.length === 0) {
      setMarkingAll(false);
      setSuccess("Все уже отмечены");
      return;
    }
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ student_ids: ids, status: "present" }),
    });
    const data = await res.json();
    setMarkingAll(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка массовой отметки");
      return;
    }
    setTodayAttendance((prev) => {
      const next = { ...prev };
      for (const id of data.student_ids ?? ids) {
        next[id] = "present";
      }
      return next;
    });
    setSuccess(`Все отмечены как пришли (${data.marked ?? ids.length})`);
  }

  async function submitGrade(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
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
      onRefresh={load}
      refreshing={loading}
    >
      {error && <p className="lc-alert lc-alert-error mb-4">{error}</p>}
      {success && <p className="lc-alert lc-alert-success mb-4">{success}</p>}

      {tab === "students" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Мои ученики ({filteredStudents.length}
                {shiftFilter !== "all" ? ` · ${shiftFilter}` : ` / ${students.length}`})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Отмечено сегодня: {markedToday} из {students.length}
              </p>
            </div>
            {students.length > 0 && (
              <button
                type="button"
                onClick={markAllPresent}
                disabled={markingAll}
                className="lc-btn lc-btn-primary px-3 py-2 text-xs disabled:opacity-50"
              >
                {markingAll ? "Отмечаю…" : "Все пришли"}
              </button>
            )}
          </div>

          {shiftNames.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShiftFilter("all")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  shiftFilter === "all"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                Все часы
              </button>
              {shiftNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setShiftFilter(name)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    shiftFilter === name
                      ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, коду или смене…"
            className="lc-input mb-4"
          />

          {loading && students.length === 0 ? (
            <p className="lc-card-flat p-4 text-center text-sm text-slate-500">
              Загрузка…
            </p>
          ) : filteredStudents.length === 0 ? (
            <p className="lc-card-flat p-4 text-center text-sm text-slate-500">
              {students.length === 0
                ? "Пока нет учеников. Админ добавит их в панели."
                : "Ничего не найдено"}
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredStudents.map((s) => {
                const todayStatus = todayAttendance[s.id];
                return (
                  <li key={s.id} className="lc-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">{s.full_name}</p>
                        <p className="font-mono text-sm text-indigo-600">
                          {s.student_code}
                        </p>
                        {s.group_name ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Во сколько: {s.group_name}
                          </p>
                        ) : null}
                        {s.phone ? (
                          <a
                            href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                            className="mt-1 block text-sm font-medium text-emerald-700"
                          >
                            📞 {s.phone}
                          </a>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">Номера нет</p>
                        )}
                        {s.telegram_username ? (
                          <a
                            href={`https://t.me/${s.telegram_username.replace(/^@/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sm font-medium text-sky-700"
                          >
                            💬 @{s.telegram_username.replace(/^@/, "")}
                          </a>
                        ) : (
                          <p className="text-xs text-slate-400">Telegram не привязан</p>
                        )}
                      </div>
                      {todayStatus && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {STATUS_LABELS[todayStatus]}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => mark(s.id, "present")}
                        className={`lc-btn rounded-xl py-3 text-sm font-semibold ${
                          todayStatus === "present"
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        ✅ Пришёл
                      </button>
                      <button
                        type="button"
                        onClick={() => mark(s.id, "late")}
                        className={`lc-btn rounded-xl py-3 text-sm font-semibold ${
                          todayStatus === "late"
                            ? "bg-amber-600 text-white"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        ⏰ Опоздал
                      </button>
                      <button
                        type="button"
                        onClick={() => mark(s.id, "absent")}
                        className={`lc-btn rounded-xl py-3 text-sm font-semibold ${
                          todayStatus === "absent"
                            ? "bg-red-600 text-white"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        ❌ Нет
                      </button>
                    </div>
                  </li>
                );
              })}
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