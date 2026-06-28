"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CredentialsCard } from "@/components/admin/CredentialsCard";
import { AccountListItem } from "@/components/admin/AccountListItem";
import { AdminSubLayout } from "@/components/layout/AdminSubLayout";

type Teacher = { id: string; full_name: string; teacher_code: string };
type Student = {
  id: string;
  full_name: string;
  student_code: string;
  phone: string | null;
  teacher_name?: string;
  start_date: string | null;
  payment_due_day: number | null;
};

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateRu(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function AdminStudentsPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0 });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    total_pages: 1,
  });
  const [listFilterTeacher, setListFilterTeacher] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);

  const [teacherId, setTeacherId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("500000");
  const [startDate, setStartDate] = useState(todayIso);
  const [paymentDueDay, setPaymentDueDay] = useState("10");
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

  const mapStudent = (s: {
    id: string;
    first_name: string;
    last_name: string;
    student_code: string;
    phone: string | null;
    teacher_name?: string | null;
    start_date?: string | null;
    payment_due_day?: number | null;
  }): Student => ({
    id: s.id,
    full_name: `${s.last_name} ${s.first_name}`.trim(),
    student_code: s.student_code,
    phone: s.phone,
    teacher_name: s.teacher_name ?? undefined,
    start_date: s.start_date ?? null,
    payment_due_day: s.payment_due_day ?? null,
  });

  const loadTeachers = useCallback(async () => {
    const res = await fetch("/api/teachers");
    const data = await res.json();
    if (res.ok) setTeachers(data.teachers ?? []);
  }, []);

  const loadStudents = useCallback(async () => {
    setListLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      status: statusFilter,
    });
    if (search.trim()) params.set("search", search.trim());
    if (listFilterTeacher) params.set("teacher_id", listFilterTeacher);

    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    setListLoading(false);

    if (!res.ok) return;

    setStudents((data.students ?? []).map(mapStudent));
    setPagination(
      data.pagination ?? {
        total: 0,
        page: 1,
        limit: PAGE_SIZE,
        total_pages: 1,
      },
    );
    if (data.summary) setSummary(data.summary);
  }, [page, search, listFilterTeacher, statusFilter]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [listFilterTeacher, statusFilter]);

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
          monthly_fee: Number(monthlyFee) || 500000,
          start_date: startDate,
          payment_due_day: Number(paymentDueDay) || 10,
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
      setStartDate(todayIso());
      setPage(1);
      loadStudents();
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
    <AdminSubLayout
      title="Ученики"
      description={
        <>
          Шаг 2: выберите учителя и добавьте ученика. Код и пароль — для{" "}
          <Link href="/student/login" className="font-medium text-emerald-600 underline">
            кабинета ученика
          </Link>
          . Список — по 50 человек, с поиском.
        </>
      }
    >
        {teachers.length === 0 && (
          <div className="lc-alert mb-6 border-amber-200 bg-amber-50 text-amber-900">
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

        <form onSubmit={handleSubmit} className="lc-card mb-8 space-y-4 p-6">
          <div>
            <label className="lc-label">Учитель *</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required
              className="lc-input"
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
            <label className="lc-label">ФИО ученика *</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="lc-input"
            />
          </div>
          <div>
            <label className="lc-label">Телефон</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="lc-input"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="lc-label">Дата начала занятий *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="lc-input"
              />
            </div>
            <div>
              <label className="lc-label">День оплаты в месяце (1–28) *</label>
              <input
                type="number"
                min={1}
                max={28}
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(e.target.value)}
                required
                className="lc-input"
              />
            </div>
          </div>
          <div>
            <label className="lc-label">
              Оплата в месяц (сум) — только для отчёта владельца, ученик не видит
            </label>
            <input
              type="number"
              min={0}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              className="lc-input"
              placeholder="500000"
            />
          </div>
          {error && <p className="lc-alert lc-alert-error">{error}</p>}
          <button
            type="submit"
            disabled={loading || teachers.length === 0}
            className="lc-btn lc-btn-student px-5 py-2.5 disabled:opacity-50"
          >
            {loading ? "Создание…" : "Добавить ученика"}
          </button>
        </form>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Список ({pagination.total})
            </h2>
            <p className="text-sm text-slate-500">
              Всего в базе: {summary.total} · активных: {summary.active}
            </p>
          </div>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по имени, коду, телефону…"
            className="lc-input w-full max-w-sm"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={listFilterTeacher}
            onChange={(e) => setListFilterTeacher(e.target.value)}
            className="lc-input w-auto min-w-[180px]"
          >
            <option value="">Все учителя</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          {(
            [
              { id: "all", label: "Все" },
              { id: "active", label: "Активные" },
              { id: "inactive", label: "Неактивные" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === f.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-slate-500">
          Код виден всегда. Пароль зашифрован — только сброс. Показано{" "}
          {students.length} из {pagination.total}.
        </p>

        {listLoading && students.length === 0 ? (
          <p className="lc-card-flat p-4 text-center text-slate-500">
            Загрузка списка…
          </p>
        ) : students.length === 0 ? (
          <p className="lc-card-flat p-4 text-center text-slate-500">
            Ничего не найдено
          </p>
        ) : (
          <ul className={`space-y-2 ${listLoading ? "opacity-60" : ""}`}>
            {students.map((s) => {
              const dateInfo = `Старт: ${formatDateRu(s.start_date)} · Оплата: ${s.payment_due_day ?? 10}-е число`;
              const subtitle = s.teacher_name
                ? `Учитель: ${s.teacher_name} · ${dateInfo}`
                : s.phone
                  ? `${s.phone} · ${dateInfo}`
                  : dateInfo;
              return (
                <AccountListItem
                  key={s.id}
                  name={s.full_name}
                  code={s.student_code}
                  subtitle={subtitle}
                  onResetPassword={() => handleResetPassword(s.id)}
                  resetting={resettingId === s.id}
                />
              );
            })}
          </ul>
        )}

        {pagination.total_pages > 1 && (
          <div className="lc-card-flat mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-slate-500">
              Страница {pagination.page} из {pagination.total_pages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || listLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="lc-btn px-3 py-1.5 text-sm disabled:opacity-50"
              >
                ← Назад
              </button>
              <button
                type="button"
                disabled={
                  pagination.page >= pagination.total_pages || listLoading
                }
                onClick={() =>
                  setPage((p) => Math.min(pagination.total_pages, p + 1))
                }
                className="lc-btn px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
    </AdminSubLayout>
  );
}