"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CredentialsCard } from "@/components/admin/CredentialsCard";
import { AccountListItem } from "@/components/admin/AccountListItem";

type Teacher = { id: string; full_name: string; teacher_code: string };
type Student = {
  id: string;
  full_name: string;
  student_code: string;
  phone: string | null;
  teacher_name?: string;
};

export default function AdminStudentsPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<{
    code: string;
    password: string;
  } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const parseFullName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { last_name: parts[0], first_name: parts[0] };
    return { last_name: parts[0], first_name: parts.slice(1).join(" ") };
  };

  const load = async () => {
    const [tRes, sRes] = await Promise.all([
      fetch("/api/teachers"),
      fetch("/api/students"),
    ]);
    const tData = await tRes.json();
    const sData = await sRes.json();
    if (tRes.ok) setTeachers(tData.teachers ?? []);
    if (sRes.ok) {
      setStudents(
        (sData.students ?? []).map(
          (s: {
            id: string;
            first_name: string;
            last_name: string;
            student_code: string;
            phone: string | null;
            teacher_name?: string | null;
          }) => ({
            id: s.id,
            full_name: `${s.last_name} ${s.first_name}`.trim(),
            student_code: s.student_code,
            phone: s.phone,
            teacher_name: s.teacher_name ?? undefined,
          }),
        ),
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCredentials(null);
    if (!teacherId) {
      setError("Выберите учителя");
      return;
    }
    setLoading(true);
    try {
      const { first_name, last_name } = parseFullName(fullName);
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name,
          last_name,
          phone: phone || undefined,
          teacher_id: teacherId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setCredentials({
        code: data.student.student_code,
        password: data.student.plain_password,
      });
      setFullName("");
      setPhone("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm("Сбросить пароль? Старый пароль перестанет работать.")) return;
    setResettingId(id);
    setCredentials(null);
    try {
      const res = await fetch(`/api/students/${id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setCredentials({
        code: data.credentials.student_code,
        password: data.credentials.plain_password,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Ученики</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Админ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-6 text-gray-600">
          Шаг 2: выберите учителя и добавьте ученика. Код и пароль — для{" "}
          <Link href="/student/login" className="text-blue-600 underline">
            /student/login
          </Link>
        </p>

        {teachers.length === 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            Сначала добавьте учителя на{" "}
            <Link href="/admin/teachers" className="underline">
              /admin/teachers
            </Link>
          </div>
        )}

        {credentials && (
          <CredentialsCard
            title="Данные для входа (сохраните!)"
            code={credentials.code}
            password={credentials.password}
            onClose={() => setCredentials(null)}
          />
        )}

        <form
          onSubmit={handleSubmit}
          className="mb-8 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Учитель *
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">— выберите —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.teacher_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              ФИО ученика *
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Телефон
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || teachers.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Создание…" : "Добавить ученика"}
          </button>
        </form>

        <h2 className="mb-3 font-semibold text-gray-900">
          Список ({students.length})
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Код виден всегда. Пароль хранится в зашифрованном виде — посмотреть нельзя, только сбросить.
        </p>
        <ul className="space-y-2">
          {students.map((s) => (
            <AccountListItem
              key={s.id}
              name={s.full_name}
              code={s.student_code}
              subtitle={
                s.teacher_name ? `Учитель: ${s.teacher_name}` : s.phone || undefined
              }
              onResetPassword={() => handleResetPassword(s.id)}
              resetting={resettingId === s.id}
            />
          ))}
        </ul>
        {students.length === 0 && (
          <p className="text-gray-500">Пока нет учеников</p>
        )}
      </main>
    </div>
  );
}