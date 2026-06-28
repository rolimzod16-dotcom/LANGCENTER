"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  teacher_name: string | null;
};

type Teacher = { id: string; full_name: string; teacher_code: string };

type Credentials = {
  name: string;
  student_code: string;
  plain_password: string;
};

function CredentialsCard({
  credentials,
  onClose,
}: {
  credentials: Credentials;
  onClose?: () => void;
}) {
  async function copyAll() {
    await navigator.clipboard.writeText(
      `Код: ${credentials.student_code}\nПароль: ${credentials.plain_password}`,
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5 shadow-md">
      <p className="text-lg font-bold text-emerald-900">
        Данные для входа — {credentials.name}
      </p>
      <div className="mt-4 space-y-3 rounded-xl bg-white p-4">
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Код</p>
          <p className="font-mono text-xl font-bold text-indigo-700">
            {credentials.student_code}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Пароль</p>
          <p className="font-mono text-xl font-bold text-emerald-800">
            {credentials.plain_password}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={copyAll}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
      >
        Скопировать код + пароль
      </button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-2 mt-4 text-sm text-emerald-800"
        >
          Закрыть
        </button>
      )}
    </div>
  );
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [form, setForm] = useState({
    teacher_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [sRes, tRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/teachers"),
      ]);
      const sData = await sRes.json();
      const tData = await tRes.json();
      if (!sRes.ok) throw new Error(sData.error);
      if (!tRes.ok) throw new Error(tData.error);
      setStudents(sData.students);
      setTeachers(tData.teachers);
      if (tData.teachers[0] && !form.teacher_id) {
        setForm((f) => ({ ...f, teacher_id: tData.teachers[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teachers.length) {
      setError("Сначала добавь учителя (Шаг 1)");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");

      const student = data.student;
      setCredentials({
        name: `${student.last_name} ${student.first_name}`,
        student_code: student.student_code,
        plain_password: student.plain_password,
      });
      setForm((f) => ({
        teacher_id: f.teacher_id,
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
      }));
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(student: Student) {
    setResettingId(student.id);
    setError("");
    try {
      const res = await fetch(`/api/students/${student.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setCredentials({
        name: `${student.last_name} ${student.first_name}`,
        student_code: data.credentials.student_code,
        plain_password: data.credentials.plain_password,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setResettingId(null);
    }
  }

  if (!loading && teachers.length === 0) {
    return (
      <AppShell title="Шаг 2 — Ученики" subtitle="Сначала нужен учитель">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="text-lg font-semibold text-amber-900">
            Нет учителей!
          </p>
          <p className="mt-2 text-amber-800">
            Сначала выполни Шаг 1 — добавь хотя бы одного учителя.
          </p>
          <Link
            href="/admin/teachers"
            className="mt-6 inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white"
          >
            ← Шаг 1: Добавить учителя
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Шаг 2 — Ученики"
      subtitle="Выбери учителя → добавь ученика → он сразу у этого учителя"
    >
      <div className="mb-6 flex gap-3 text-sm">
        <Link href="/admin" className="text-zinc-500">
          ← Админ
        </Link>
        <Link href="/admin/teachers" className="text-indigo-600">
          Шаг 1: Учителя
        </Link>
      </div>

      {credentials && (
        <div className="mb-8">
          <CredentialsCard
            credentials={credentials}
            onClose={() => setCredentials(null)}
          />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h2 className="font-semibold">Новый ученик</h2>

          <label className="mt-4 block text-sm font-medium text-zinc-700">
            Учитель *
          </label>
          <select
            required
            value={form.teacher_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, teacher_id: e.target.value }))
            }
            className="mt-1 mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2"
          >
            <option value="">К какому учителю?</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.teacher_code})
              </option>
            ))}
          </select>

          <div className="space-y-3">
            <input
              required
              placeholder="Имя"
              value={form.first_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, first_name: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <input
              required
              placeholder="Фамилия"
              value={form.last_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, last_name: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <input
              placeholder="Телефон"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Сохранение..." : "Добавить ученика"}
            </button>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Список ({students.length})</h2>
          {loading ? (
            <p className="mt-4 text-sm text-zinc-500">Загрузка...</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {s.last_name} {s.first_name}
                    </p>
                    <p className="font-mono text-sm text-indigo-600">
                      {s.student_code}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Учитель: {s.teacher_name ?? "не назначен"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={resettingId === s.id}
                    onClick={() => handleResetPassword(s)}
                    className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700"
                  >
                    {resettingId === s.id ? "..." : "Новый пароль"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}