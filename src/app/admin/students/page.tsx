"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CredentialsCard } from "@/components/admin/CredentialsCard";
import { AdminSubLayout } from "@/components/layout/AdminSubLayout";

type Teacher = { id: string; full_name: string; teacher_code: string };
type Billing = {
  student_id: string;
  payment_due_day: number;
  period_month: string;
  due_date: string;
  next_due_date: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  debt: number;
  has_invoice: boolean;
  payment_id: string | null;
  can_mark_paid: boolean;
  can_mark_unpaid: boolean;
  label: string;
};

type Student = {
  id: string;
  full_name: string;
  student_code: string;
  phone: string | null;
  teacher_name?: string;
  start_date: string | null;
  payment_due_day: number | null;
  password_plain?: string | null;
  billing?: Billing | null;
};

type StatusFilter = "all" | "active" | "inactive";
type PaymentFilter = "all" | "paid" | "debt" | "overdue" | "new";

const PAYMENT_FILTERS: { id: PaymentFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "debt", label: "Должники" },
  { id: "overdue", label: "Просрочено" },
  { id: "paid", label: "Оплачено" },
  { id: "new", label: "Новые" },
];

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
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
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
  const [payingId, setPayingId] = useState<string | null>(null);

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
    password_plain?: string | null;
    plain_password?: string | null;
    billing?: Billing | null;
  }): Student => ({
    id: s.id,
    full_name: `${s.last_name} ${s.first_name}`.trim(),
    student_code: s.student_code,
    phone: s.phone,
    teacher_name: s.teacher_name ?? undefined,
    start_date: s.start_date ?? null,
    payment_due_day: s.payment_due_day ?? null,
    password_plain: s.password_plain ?? s.plain_password ?? null,
    billing: s.billing ?? null,
  });

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const isPhoneSearch =
    search.replace(/\D/g, "").length >= 4 &&
    search.replace(/\D/g, "").length >= search.replace(/\s/g, "").length * 0.5;

  const loadTeachers = useCallback(async () => {
    const res = await fetch("/api/teachers", { credentials: "include" });
    const data = await res.json();
    if (res.ok) {
      setTeachers(data.teachers ?? []);
      return;
    }
    if (res.status === 401) {
      setListError("Нет доступа. Войдите в админку заново.");
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setListLoading(true);
    setListError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      status: statusFilter,
      payment_filter: paymentFilter,
    });
    if (search.trim()) params.set("search", search.trim());
    if (listFilterTeacher) params.set("teacher_id", listFilterTeacher);

    const res = await fetch(`/api/students?${params}`, {
      credentials: "include",
    });
    const data = await res.json();
    setListLoading(false);

    if (!res.ok) {
      setListError(
        data.error ??
          (res.status === 401
            ? "Нет доступа. Войдите в админку заново."
            : "Не удалось загрузить учеников"),
      );
      return;
    }

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
  }, [page, search, listFilterTeacher, statusFilter, paymentFilter]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    if (!teacherId) {
      setGroups([]);
      setGroupId("");
      return;
    }
    fetch(`/api/groups?teacher_id=${encodeURIComponent(teacherId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data.groups ?? [];
        setGroups(list);
        setGroupId(list[0]?.id ?? "");
      })
      .catch(() => {
        setGroups([]);
        setGroupId("");
      });
  }, [teacherId]);

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
  }, [listFilterTeacher, statusFilter, paymentFilter]);

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
          group_id: groupId || undefined,
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
      // Обновить пароль в карточке списка
      setStudents((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, password_plain: data.credentials.plain_password }
            : s,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setResettingId(null);
    }
  };

  const handleCashStatus = async (
    studentId: string,
    action: "paid" | "unpaid",
  ) => {
    setPayingId(studentId);
    setListError("");
    try {
      const res = await fetch("/api/payments/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ student_id: studentId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка оплаты");

      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, billing: data.billing as Billing }
            : s,
        ),
      );
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Ошибка оплаты");
    } finally {
      setPayingId(null);
    }
  };

  const billingBadge = (status: string) => {
    if (status === "paid")
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (status === "overdue")
      return "bg-red-100 text-red-800 border-red-200";
    if (status === "partial")
      return "bg-amber-100 text-amber-800 border-amber-200";
    if (status === "new")
      return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const billingTitle = (status: string) => {
    if (status === "paid") return "Оплатил";
    if (status === "overdue") return "Просрочено";
    if (status === "partial") return "Частично";
    if (status === "new") return "Нет счёта";
    return "Не оплатил";
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

        {listError && (
          <div className="lc-alert lc-alert-error mb-6">
            {listError}
            {listError.includes("column") && (
              <p className="mt-2 text-sm">
                Запустите <code className="rounded bg-red-100 px-1">supabase/FIX_SCHEMA_CLEAN.sql</code>{" "}
                в Supabase SQL Editor
              </p>
            )}
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
          {teacherId && groups.length > 0 && (
            <div>
              <label className="lc-label">Группа</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="lc-input"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            <label className="lc-label">Телефон родителя / контакт</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="lc-input"
              placeholder="+998 90 123 45 67"
            />
            <p className="mt-1 text-xs text-slate-500">
              Один номер можно указать у нескольких учеников (братья, сёстры).
              Поиск по телефону покажет всех прикреплённых.
            </p>
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
            placeholder="ФИО, код STU-… или телефон"
            className="lc-input w-full max-w-sm"
          />
        </div>

        {search && isPhoneSearch && !listLoading && students.length > 0 && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            Поиск по телефону «{search}»: найдено{" "}
            <strong>{pagination.total}</strong>{" "}
            {pagination.total === 1
              ? "ученик"
              : pagination.total < 5
                ? "ученика"
                : "учеников"}{" "}
            с этим / похожим номером.
          </div>
        )}

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

        <div className="mb-4 flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Оплата:
          </span>
          {PAYMENT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPaymentFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                paymentFilter === f.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-slate-500">
          Логин и пароль всегда видны в карточке. Наличные:{" "}
          <strong>Оплатил</strong> / <strong>Не оплатил</strong> (цикл 10.10 →
          10.11). Показано {students.length} из {pagination.total}.
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
          <ul className={`space-y-3 ${listLoading ? "opacity-60" : ""}`}>
            {students.map((s) => {
              const b = s.billing;
              const dateInfo = `Старт: ${formatDateRu(s.start_date)} · День оплаты: ${s.payment_due_day ?? 10}-е`;
              const subtitle = s.teacher_name
                ? `Учитель: ${s.teacher_name} · ${dateInfo}`
                : s.phone
                  ? `${s.phone} · ${dateInfo}`
                  : dateInfo;
              return (
                <li
                  key={s.id}
                  className="lc-card space-y-3 p-4 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{s.full_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

                    {/* Логин и пароль — всегда видны админу */}
                    <div className="mt-2 grid gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm sm:max-w-md">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Логин
                        </span>
                        <span className="font-mono font-bold text-indigo-700">
                          {s.student_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(s.student_code)}
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          Копировать
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Пароль (для восстановления)
                        </span>
                        {s.password_plain ? (
                          <>
                            <span className="font-mono font-bold text-slate-900">
                              {s.password_plain}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(s.password_plain!)}
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              Копировать
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(
                                  `Логин: ${s.student_code}\nПароль: ${s.password_plain}`,
                                )
                              }
                              className="text-xs font-semibold text-emerald-700 hover:underline"
                            >
                              Копировать логин + пароль
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-amber-700">
                            Не сохранён — нажми «Новый пароль» (один раз), дальше
                            будет всегда виден
                          </span>
                        )}
                      </div>
                    </div>

                    {b && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${billingBadge(b.status)}`}
                        >
                          {billingTitle(b.status)}
                        </span>
                        <span className="text-xs text-slate-600">
                          Срок: {formatDateRu(b.due_date)}
                        </span>
                        <span className="text-xs text-slate-500">
                          → след.: {formatDateRu(b.next_due_date)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        payingId === s.id || !b?.can_mark_paid
                      }
                      onClick={() => handleCashStatus(s.id, "paid")}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Наличные получены за текущий месяц"
                    >
                      {payingId === s.id ? "…" : "✓ Оплатил"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        payingId === s.id || !b?.can_mark_unpaid
                      }
                      onClick={() => handleCashStatus(s.id, "unpaid")}
                      className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Сбросить оплату за текущий месяц"
                    >
                      Не оплатил
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(s.id)}
                      disabled={resettingId === s.id}
                      className="lc-btn lc-btn-warning shrink-0 px-3 py-2 text-xs disabled:opacity-50"
                      title="Сгенерировать новый пароль (старый перестанет работать)"
                    >
                      {resettingId === s.id ? "…" : "Новый пароль"}
                    </button>
                  </div>
                </li>
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