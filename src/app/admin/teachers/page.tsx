"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CredentialsCard } from "@/components/admin/CredentialsCard";
import { AccountListItem } from "@/components/admin/AccountListItem";

type Teacher = {
  id: string;
  full_name: string;
  teacher_code: string;
  phone: string | null;
};

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
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
    const res = await fetch("/api/teachers");
    const data = await res.json();
    if (res.ok) setTeachers(data.teachers ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCredentials(null);
    setLoading(true);
    try {
      const { first_name, last_name } = parseFullName(fullName);
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name,
          last_name,
          phone: phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setCredentials({
        code: data.teacher.teacher_code,
        password: data.teacher.plain_password,
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
      const res = await fetch(`/api/teachers/${id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setCredentials({
        code: data.credentials.teacher_code,
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
          <h1 className="text-xl font-bold text-gray-900">Учителя</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Админ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-6 text-gray-600">
          Шаг 1: добавьте учителя. Код и пароль — для входа на{" "}
          <Link href="/teacher/login" className="text-blue-600 underline">
            /teacher/login
          </Link>
        </p>

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
              ФИО *
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Иванов Иван Иванович"
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
              placeholder="+998..."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Создание…" : "Добавить учителя"}
          </button>
        </form>

        <h2 className="mb-3 font-semibold text-gray-900">
          Список ({teachers.length})
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Код виден всегда. Пароль хранится в зашифрованном виде — посмотреть нельзя, только сбросить.
        </p>
        <ul className="space-y-2">
          {teachers.map((t) => (
            <AccountListItem
              key={t.id}
              name={t.full_name}
              code={t.teacher_code}
              subtitle={t.phone || undefined}
              onResetPassword={() => handleResetPassword(t.id)}
              resetting={resettingId === t.id}
            />
          ))}
        </ul>
        {teachers.length === 0 && (
          <p className="text-gray-500">Пока нет учителей</p>
        )}

        <Link
          href="/admin/students"
          className="mt-8 inline-block rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          Шаг 2: добавить учеников →
        </Link>
      </main>
    </div>
  );
}