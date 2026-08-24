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
  password_plain?: string | null;
};

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [groupName, setGroupName] = useState("");
  const [extraGroupTeacher, setExtraGroupTeacher] = useState("");
  const [extraGroupName, setExtraGroupName] = useState("");
  const [extraLoading, setExtraLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<{
    code: string;
    password: string;
  } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [listError, setListError] = useState("");

  const parseFullName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { last_name: parts[0], first_name: parts[0] };
    return { last_name: parts[0], first_name: parts.slice(1).join(" ") };
  };

  const load = async () => {
    setListError("");
    const res = await fetch("/api/teachers", { credentials: "include" });
    const data = await res.json();
    if (res.ok) {
      setTeachers(data.teachers ?? []);
      return;
    }
    setListError(
      data.error ??
        (res.status === 401
          ? "Нет доступа. Войдите в админку заново."
          : "Не удалось загрузить учителей. Проверьте подключение к базе."),
    );
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
          group_name: groupName.trim() || undefined,
          lesson_times: groupName.trim()
            ? groupName.split(/[,;\n]+/).map((s) => s.trim())
            : undefined,
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
      setGroupName("");
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
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, password_plain: data.credentials.plain_password }
            : t,
        ),
      );
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
          Шаг 1: добавьте учителя и его смены. Потом на{" "}
          <Link href="/admin/students" className="font-medium text-emerald-600 underline">
            учениках
          </Link>{" "}
          можно добавлять новых и закреплять на одну или несколько смен.
        </>
      }
    >

        {listError && (
          <div className="lc-alert lc-alert-error mb-6">{listError}</div>
        )}

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
          <div>
            <label className="lc-label">Часы уроков</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="lc-input"
              placeholder="09:00, 14:00, 18:30"
            />
            <p className="mt-1 text-xs text-slate-500">
              Во сколько ведёт. Через запятую — каждая цифра это отдельная смена.
              Потом можно добавить ещё часы.
            </p>
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

        {teachers.length > 0 && (
          <form
            className="lc-card mb-8 space-y-4 p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!extraGroupTeacher || !extraGroupName.trim()) return;
              setExtraLoading(true);
              setError("");
              try {
                const res = await fetch("/api/groups", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    teacher_id: extraGroupTeacher,
                    times: extraGroupName.split(/[,;\n]+/).map((s) => s.trim()),
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Ошибка");
                setExtraGroupName("");
                const created = (data.groups ?? [data.group])
                  .map((g: { name?: string }) => g?.name)
                  .filter(Boolean);
                alert(
                  created.length
                    ? `Часы: ${created.join(", ")}`
                    : "Слот создан",
                );
              } catch (err) {
                setError(err instanceof Error ? err.message : "Ошибка");
              } finally {
                setExtraLoading(false);
              }
            }}
          >
            <h2 className="text-base font-bold text-slate-900">
              Добавить часы учителю
            </h2>
            <p className="text-sm text-slate-500">
              Новые слоты по времени. Ученика потом сажают на один час или на несколько.
            </p>
            <div>
              <label className="lc-label">Учитель *</label>
              <select
                value={extraGroupTeacher}
                onChange={(e) => setExtraGroupTeacher(e.target.value)}
                required
                className="lc-input"
              >
                <option value="">— выберите —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lc-label">Часы *</label>
              <input
                value={extraGroupName}
                onChange={(e) => setExtraGroupName(e.target.value)}
                required
                className="lc-input"
                placeholder="16:00, 19:00"
              />
              <p className="mt-1 text-xs text-slate-500">
                Формат 09:00 — можно несколько через запятую.
              </p>
            </div>
            <button
              type="submit"
              disabled={extraLoading}
              className="lc-btn lc-btn-ghost px-5 py-2.5 disabled:opacity-50"
            >
              {extraLoading ? "Создание…" : "Добавить часы"}
            </button>
          </form>
        )}

        <h2 className="mb-2 text-lg font-bold text-slate-900">
          Список ({teachers.length})
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Логин и пароль видны только админу. После «Новый пароль» старый
          перестаёт работать.
        </p>
        <ul className="space-y-2">
          {teachers.map((t) => (
            <AccountListItem
              key={t.id}
              name={t.full_name}
              code={t.teacher_code}
              password={t.password_plain}
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