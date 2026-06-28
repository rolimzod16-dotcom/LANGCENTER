"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CredentialsCard } from "@/components/admin/CredentialsCard";
import { AccountListItem } from "@/components/admin/AccountListItem";
import { AdminSubLayout } from "@/components/layout/AdminSubLayout";

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
    <AdminSubLayout
      title="Учителя"
      description={
        <>
          Шаг 1: добавьте учителя. Код и пароль — для входа в{" "}
          <Link href="/teacher/login" className="font-medium text-indigo-600 underline">
            кабинет учителя
          </Link>
        </>
      }
    >

        {credentials && (
          <CredentialsCard
            title="Данные для входа (сохраните!)"
            code={credentials.code}
            password={credentials.password}
            onClose={() => setCredentials(null)}
          />
        )}

        <form onSubmit={handleSubmit} className="lc-card mb-8 space-y-4 p-6">
          <div>
            <label className="lc-label">ФИО *</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="lc-input"
              placeholder="Иванов Иван Иванович"
            />
          </div>
          <div>
            <label className="lc-label">Телефон</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="lc-input"
              placeholder="+998..."
            />
          </div>
          {error && <p className="lc-alert lc-alert-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="lc-btn lc-btn-primary px-5 py-2.5 disabled:opacity-50"
          >
            {loading ? "Создание…" : "Добавить учителя"}
          </button>
        </form>

        <h2 className="mb-2 text-lg font-bold text-slate-900">
          Список ({teachers.length})
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Код виден всегда. Пароль зашифрован — только сброс.
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
          <p className="lc-card-flat p-4 text-center text-slate-500">
            Пока нет учителей
          </p>
        )}

        <Link
          href="/admin/students"
          className="lc-btn lc-btn-student mt-8 inline-flex px-5 py-2.5"
        >
          Шаг 2: добавить учеников →
        </Link>
    </AdminSubLayout>
  );
}