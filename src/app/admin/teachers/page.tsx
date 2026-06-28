"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

type Teacher = {
  id: string;
  full_name: string;
  teacher_code: string;
};

type Credentials = {
  name: string;
  teacher_code: string;
  plain_password: string;
};

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    group_name: "",
  });

  async function load() {
    const res = await fetch("/api/teachers");
    const data = await res.json();
    if (res.ok) setTeachers(data.teachers);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setCredentials({
      name: data.teacher.full_name,
      teacher_code: data.teacher.teacher_code,
      plain_password: data.teacher.plain_password,
    });
    setForm({ first_name: "", last_name: "", email: "", phone: "", group_name: "" });
    load();
  }

  return (
    <AppShell
      title="Шаг 1 — Учителя"
      subtitle="Сначала добавь учителей, потом переходи к ученикам"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin" className="text-zinc-500 hover:text-zinc-800">
          ← Админ
        </Link>
        {teachers.length > 0 && (
          <Link
            href="/admin/students"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Шаг 2 → Добавить ученика
          </Link>
        )}
      </div>

      {credentials && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5">
          <p className="font-bold text-emerald-900">Учитель создан — {credentials.name}</p>
          <p className="mt-2 font-mono text-lg">Код: {credentials.teacher_code}</p>
          <p className="font-mono text-lg">Пароль: {credentials.plain_password}</p>
          <p className="mt-2 text-sm text-emerald-800">Передай учителю для входа в /teacher/login</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h2 className="font-semibold">Новый учитель</h2>
          <div className="mt-4 space-y-3">
            <input
              required
              placeholder="Имя"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              required
              placeholder="Фамилия"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Группа (English B1)"
              value={form.group_name}
              onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Телефон"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white"
            >
              Добавить учителя
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </form>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Учителя ({teachers.length})</h2>
          {teachers.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              Добавь первого учителя — без него шаг 2 недоступен
            </p>
          ) : (
            <ul className="mt-4 divide-y">
              {teachers.map((t) => (
                <li key={t.id} className="py-3">
                  <p className="font-medium">{t.full_name}</p>
                  <p className="font-mono text-sm text-indigo-600">{t.teacher_code}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}