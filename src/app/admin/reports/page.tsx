"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminSubLayout } from "@/components/layout/AdminSubLayout";
import { formatMoney } from "@/lib/payments";

type Payment = {
  id: string | null;
  student_id: string;
  student_name: string;
  student_code: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_at?: string | null;
  start_date: string | null;
  status: string;
  has_invoice: boolean;
};

type TeacherPayroll = {
  teacher_id: string;
  teacher_name: string;
  teacher_code: string;
  student_count: number;
  course_total: number;
  salary: number;
};

type MonthSummary = {
  total_students: number;
  active_students: number;
  total_income: number;
  total_expected: number;
  total_debt: number;
  profit: number;
  paid_count: number;
  debt_count: number;
  overdue_count: number;
  new_count: number;
  billing_count: number;
  teacher_payroll_total: number;
  net_profit_after_payroll: number;
};

type DaySummary = {
  received_total: number;
  received_count: number;
  due_today_total: number;
  due_today_count: number;
  due_today_unpaid_total: number;
  due_today_unpaid_count: number;
  teacher_payroll_total: number;
  net_profit_after_payroll: number;
};

type DailyBreakdown = {
  date: string;
  received_total: number;
  received_count: number;
};

type ViewMode = "day" | "month";
type MonthFilter = "all" | "paid" | "debt" | "overdue" | "new";
type DaySection = "received" | "due";

const STATUS: Record<string, { label: string; className: string }> = {
  paid: { label: "Оплачено", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Ожидает", className: "bg-slate-100 text-slate-700" },
  partial: { label: "Частично", className: "bg-amber-100 text-amber-800" },
  overdue: { label: "Должен", className: "bg-red-100 text-red-800" },
  new: { label: "Новый", className: "bg-blue-100 text-blue-800" },
};

const MONTH_FILTERS: { id: MonthFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "debt", label: "Должники" },
  { id: "overdue", label: "Просрочено" },
  { id: "paid", label: "Оплачено" },
  { id: "new", label: "Новые" },
];

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 350;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  return `${months[Number(m) - 1]} ${y}`;
}

function formatDateRu(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatTimeRu(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function secondsAgo(iso: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "только что";
  if (diff < 60) return `${diff} сек назад`;
  const mins = Math.floor(diff / 60);
  return `${mins} мин назад`;
}

function TeacherPayrollBlock({
  rows,
  total,
  subtitle,
}: {
  rows: TeacherPayroll[];
  total: number;
  subtitle: string;
}) {
  if (!rows.length) {
    return (
      <div className="lc-card mb-8 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">Зарплата учителей</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <p className="p-6 text-center text-slate-500">
          Нет учеников с назначенными учителями
        </p>
      </div>
    );
  }

  return (
    <div className="lc-card mb-8 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-bold text-slate-900">Зарплата учителей (50%)</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <p className="mt-2 text-lg font-bold text-amber-700">
          Итого ЗП: {formatMoney(total)}
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li
            key={row.teacher_id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="font-semibold text-slate-900">{row.teacher_name}</p>
              <p className="font-mono text-xs text-indigo-600">{row.teacher_code}</p>
              <p className="mt-1 text-sm text-slate-500">
                {row.student_count} учеников · курсы {formatMoney(row.course_total)}
              </p>
            </div>
            <p className="text-lg font-bold text-amber-700">
              {formatMoney(row.salary)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OwnerReportsPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [day, setDay] = useState(todayIso);
  const [month, setMonth] = useState(defaultMonth);
  const [daySection, setDaySection] = useState<DaySection>("received");

  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [teacherPayroll, setTeacherPayroll] = useState<TeacherPayroll[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    total_pages: 1,
  });

  const [filter, setFilter] = useState<MonthFilter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ensuringId, setEnsuringId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loadDay = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const params = new URLSearchParams({
        view: "day",
        date: day,
        section: daySection,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/owner/reports?${params}`);
      const data = await res.json();
      if (!silent) setLoading(false);

      if (!res.ok) {
        if (!silent) setError(data.error ?? "Ошибка загрузки");
        return;
      }

      setDaySummary(data.summary);
      setTeacherPayroll(data.teacher_payroll ?? []);
      setPayments(data.payments ?? []);
      setPagination(
        data.pagination ?? {
          total: 0,
          page: 1,
          limit: PAGE_SIZE,
          total_pages: 1,
        },
      );
      setLastUpdated(data.updated_at ?? new Date().toISOString());
      setError("");
    },
    [day, daySection, page, search],
  );

  const loadMonthSummary = useCallback(async (silent = false) => {
    const period = `${month}-01`;
    const res = await fetch(
      `/api/owner/reports?view=month&month=${period}&summary_only=1`,
    );
    const data = await res.json();
    if (!res.ok) {
      if (!silent) setError(data.error ?? "Ошибка загрузки");
      return;
    }
    setMonthSummary(data.summary);
    setTeacherPayroll(data.teacher_payroll ?? []);
    setLastUpdated(data.updated_at ?? new Date().toISOString());
  }, [month]);

  const loadMonthList = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const period = `${month}-01`;
      const params = new URLSearchParams({
        view: "month",
        month: period,
        page: String(page),
        limit: String(PAGE_SIZE),
        filter,
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/owner/reports?${params}`);
      const data = await res.json();
      if (!silent) setLoading(false);

      if (!res.ok) {
        if (!silent) setError(data.error ?? "Ошибка загрузки");
        return;
      }

      setMonthSummary(data.summary);
      setTeacherPayroll(data.teacher_payroll ?? []);
      setPayments(data.payments ?? []);
      setDailyBreakdown(data.daily_breakdown ?? []);
      setPagination(
        data.pagination ?? {
          total: 0,
          page: 1,
          limit: PAGE_SIZE,
          total_pages: 1,
        },
      );
      setLastUpdated(data.updated_at ?? new Date().toISOString());
      setError("");
    },
    [month, page, filter, search],
  );

  const refresh = useCallback(
    async (silent = false) => {
      if (viewMode === "day") await loadDay(silent);
      else await loadMonthList(silent);
    },
    [viewMode, loadDay, loadMonthList],
  );

  useEffect(() => {
    if (viewMode === "day") loadDay();
    else loadMonthList();
  }, [viewMode, loadDay, loadMonthList]);

  useEffect(() => {
    if (viewMode !== "day") return;
    const poll = setInterval(() => loadDay(true), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [viewMode, loadDay]);

  useEffect(() => {
    if (viewMode !== "month") return;
    const poll = setInterval(() => loadMonthSummary(true), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [viewMode, loadMonthSummary]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filter, month, day, daySection, viewMode]);

  async function generateFees() {
    setGenerating(true);
    setError("");
    const res = await fetch("/api/payments/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: `${month}-01` }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    await refresh();
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/payments/${id}/pay`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Ошибка");
      return;
    }
    await refresh(true);
  }

  async function ensureInvoice(studentId: string, periodMonth: string) {
    setEnsuringId(studentId);
    const res = await fetch("/api/payments/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, month: periodMonth }),
    });
    const data = await res.json();
    setEnsuringId(null);
    if (!res.ok) {
      alert(data.error ?? "Ошибка");
      return;
    }
    await refresh(true);
  }

  function openDayFromBreakdown(date: string) {
    setDay(date);
    setDaySection("received");
    setViewMode("day");
    setPage(1);
  }

  function buildExportUrl() {
    const params = new URLSearchParams();
    if (viewMode === "day") {
      params.set("view", "day");
      params.set("date", day);
      params.set("section", daySection);
    } else {
      params.set("view", "month");
      params.set("month", `${month}-01`);
      params.set("filter", filter);
    }
    if (search.trim()) params.set("search", search.trim());
    return `/api/owner/reports/export?${params}`;
  }

  void tick;

  const periodMonthForDay = `${day.slice(0, 7)}-01`;

  return (
    <AdminSubLayout
      title="Отчёт владельца"
      description="Ежедневный учёт наличных: что получили сегодня и у кого срок оплаты. Месячный вид — для общей картины."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode("day")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            viewMode === "day"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          По дням
        </button>
        <button
          type="button"
          onClick={() => setViewMode("month")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            viewMode === "month"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          За месяц
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        {viewMode === "day" ? (
          <>
            <div>
              <label className="lc-label">День</label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="lc-input w-auto"
              />
            </div>
            <button
              type="button"
              onClick={() => setDay(todayIso())}
              className="lc-btn lc-btn-primary px-4 py-2.5 text-sm"
            >
              Сегодня
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="lc-label">Месяц</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="lc-input w-auto"
              />
            </div>
            <button
              type="button"
              onClick={generateFees}
              disabled={generating}
              className="lc-btn lc-btn-primary px-4 py-2.5 disabled:opacity-50"
            >
              {generating ? "Создание…" : "Выставить оплату за месяц"}
            </button>
          </>
        )}
        <Link href="/admin" className="lc-btn lc-btn-ghost px-4 py-2.5 text-sm">
          ← Панель
        </Link>
        <a
          href={buildExportUrl()}
          className="lc-btn border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          Скачать отчёт (Excel)
        </a>
        {lastUpdated && (
          <p className="text-sm text-slate-500">
            Обновлено {secondsAgo(lastUpdated)}
          </p>
        )}
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Скачивание учитывает текущий фильтр и поиск — в файле все подходящие
        ученики, не только видимые на странице.
      </p>

      {error && (
        <div className="lc-alert lc-alert-error mb-6">
          {error}
          {error.includes("student_payments") && (
            <p className="mt-2 text-sm">
              Запустите{" "}
              <code className="rounded bg-red-100 px-1">supabase/PAYMENTS.sql</code>{" "}
              в Supabase SQL Editor
            </p>
          )}
        </div>
      )}

      {loading && !daySummary && !monthSummary && (
        <p className="text-slate-500">Загрузка отчёта…</p>
      )}

      {viewMode === "day" && daySummary && (
        <>
          <p className="mb-4 text-sm font-medium text-violet-700">
            День: {formatDateRu(day)}
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lc-card border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Получено за день
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {formatMoney(daySummary.received_total)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {daySummary.received_count} платежей
              </p>
            </div>

            <div className="lc-card border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                ЗП учителей (50%)
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-700">
                {formatMoney(daySummary.teacher_payroll_total)}
              </p>
              <p className="mt-1 text-xs text-slate-500">от курса / оплаты за день</p>
            </div>

            <div className="lc-card border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Чистая прибыль
              </p>
              <p className="mt-2 text-2xl font-bold text-violet-700">
                {formatMoney(daySummary.net_profit_after_payroll)}
              </p>
              <p className="mt-1 text-xs text-slate-500">после ЗП учителей</p>
            </div>

            <div className="lc-card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Срок оплаты сегодня
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {daySummary.due_today_count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                на {formatMoney(daySummary.due_today_total)}
              </p>
            </div>

            <div className="lc-card border-red-100 bg-gradient-to-br from-red-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ещё не заплатили
              </p>
              <p className="mt-2 text-2xl font-bold text-red-700">
                {daySummary.due_today_unpaid_count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                долг {formatMoney(daySummary.due_today_unpaid_total)}
              </p>
            </div>
          </div>

          <TeacherPayrollBlock
            rows={teacherPayroll}
            total={daySummary.teacher_payroll_total}
            subtitle={
              daySection === "received"
                ? "50% от суммы, полученной в этот день"
                : "50% от стоимости курса у учеников со сроком сегодня"
            }
          />

          <div className="lc-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDaySection("received")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      daySection === "received"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Получено в этот день ({daySummary.received_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaySection("due")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      daySection === "due"
                        ? "bg-red-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Срок сегодня ({daySummary.due_today_count})
                  </button>
                </div>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Поиск…"
                  className="lc-input w-full max-w-xs"
                />
              </div>
            </div>

            {loading && payments.length === 0 ? (
              <p className="p-6 text-center text-slate-500">Загрузка…</p>
            ) : payments.length === 0 ? (
              <p className="p-6 text-center text-slate-500">
                {daySection === "received"
                  ? "В этот день наличные ещё не отмечены"
                  : "В этот день никому не назначен срок оплаты"}
              </p>
            ) : (
              <ul className={`divide-y divide-slate-100 ${loading ? "opacity-60" : ""}`}>
                {payments.map((p) => {
                  const statusKey = !p.has_invoice ? "new" : p.status;
                  const st = STATUS[statusKey] ?? STATUS.pending;
                  const debt = Math.max(0, p.amount_due - p.amount_paid);
                  return (
                    <li
                      key={`${daySection}-${p.student_id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{p.student_name}</p>
                        <p className="font-mono text-xs text-indigo-600">{p.student_code}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {daySection === "received" ? (
                            <>
                              Получено {formatMoney(p.amount_paid)}
                              {p.paid_at && (
                                <span className="text-emerald-600">
                                  {" "}
                                  · {formatTimeRu(p.paid_at)}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              Срок: {formatDateRu(p.due_date)} · {formatMoney(p.amount_due)}
                              {debt > 0 && p.status !== "paid" && (
                                <span className="text-red-600">
                                  {" "}
                                  · долг {formatMoney(debt)}
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${st.className}`}
                        >
                          {st.label}
                        </span>
                        {daySection === "due" && !p.has_invoice && (
                          <button
                            type="button"
                            onClick={() => ensureInvoice(p.student_id, periodMonthForDay)}
                            disabled={ensuringId === p.student_id}
                            className="lc-btn lc-btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                          >
                            Выставить счёт
                          </button>
                        )}
                        {daySection === "due" && p.has_invoice && p.status !== "paid" && p.id && (
                          <button
                            type="button"
                            onClick={() => markPaid(p.id!)}
                            className="lc-btn lc-btn-primary px-3 py-1.5 text-xs"
                          >
                            Получил наличные
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {pagination.total_pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                <p className="text-sm text-slate-500">
                  Страница {pagination.page} из {pagination.total_pages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="lc-btn px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    ← Назад
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.total_pages || loading}
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
          </div>
        </>
      )}

      {viewMode === "month" && monthSummary && (
        <>
          <p className="mb-4 text-sm font-medium text-violet-700">
            Период: {monthLabel(month)}
            {monthSummary.new_count > 0 && (
              <span className="ml-2 text-blue-600">
                · {monthSummary.new_count} новых без счёта
              </span>
            )}
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lc-card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Учеников в отчёте
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {monthSummary.billing_count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                активных: {monthSummary.active_students}
              </p>
            </div>
            <div className="lc-card border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Получено за месяц
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {formatMoney(monthSummary.total_income)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                из {formatMoney(monthSummary.total_expected)}
              </p>
            </div>
            <div className="lc-card border-red-100 bg-gradient-to-br from-red-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Должны
              </p>
              <p className="mt-2 text-2xl font-bold text-red-700">
                {formatMoney(monthSummary.total_debt)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {monthSummary.debt_count} учеников
              </p>
            </div>
            <div className="lc-card border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                ЗП учителей (50%)
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-700">
                {formatMoney(monthSummary.teacher_payroll_total)}
              </p>
              <p className="mt-1 text-xs text-slate-500">50% от стоимости курса</p>
            </div>
            <div className="lc-card border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Чистая прибыль
              </p>
              <p className="mt-2 text-2xl font-bold text-violet-700">
                {formatMoney(monthSummary.net_profit_after_payroll)}
              </p>
              <p className="mt-1 text-xs text-slate-500">получено минус ЗП</p>
            </div>
          </div>

          <TeacherPayrollBlock
            rows={teacherPayroll}
            total={monthSummary.teacher_payroll_total}
            subtitle="50% от стоимости курса каждого ученика, по назначенному учителю"
          />

          {dailyBreakdown.length > 0 && (
            <div className="lc-card mb-8 overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold text-slate-900">По дням месяца</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Сколько наличных получено каждый день. Нажмите на день — откроется детальный отчёт.
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {dailyBreakdown.map((row) => (
                  <li key={row.date}>
                    <button
                      type="button"
                      onClick={() => openDayFromBreakdown(row.date)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">
                        {formatDateRu(row.date)}
                      </span>
                      <span className="text-sm text-slate-500">
                        {row.received_count} платежей
                      </span>
                      <span className="font-semibold text-emerald-700">
                        {formatMoney(row.received_total)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="lc-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Все оплаты месяца ({pagination.total})
                  </h2>
                </div>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Поиск по имени или коду…"
                  className="lc-input w-full max-w-xs"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {MONTH_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      filter === f.id
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && payments.length === 0 ? (
              <p className="p-6 text-center text-slate-500">Загрузка…</p>
            ) : payments.length === 0 ? (
              <p className="p-6 text-center text-slate-500">Ничего не найдено</p>
            ) : (
              <ul className={`divide-y divide-slate-100 ${loading ? "opacity-60" : ""}`}>
                {payments.map((p) => {
                  const statusKey = !p.has_invoice ? "new" : p.status;
                  const st = STATUS[statusKey] ?? STATUS.pending;
                  const debt = Math.max(0, p.amount_due - p.amount_paid);
                  return (
                    <li
                      key={p.student_id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{p.student_name}</p>
                        <p className="font-mono text-xs text-indigo-600">{p.student_code}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Срок: {formatDateRu(p.due_date)} · {formatMoney(p.amount_due)}
                          {p.amount_paid > 0 && (
                            <span className="text-emerald-600">
                              {" "}
                              · оплачено {formatMoney(p.amount_paid)}
                              {p.paid_at && ` (${formatDateRu(p.paid_at.slice(0, 10))})`}
                            </span>
                          )}
                          {debt > 0 && p.status !== "paid" && (
                            <span className="text-red-600"> · долг {formatMoney(debt)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${st.className}`}
                        >
                          {st.label}
                        </span>
                        {!p.has_invoice && (
                          <button
                            type="button"
                            onClick={() => ensureInvoice(p.student_id, `${month}-01`)}
                            disabled={ensuringId === p.student_id}
                            className="lc-btn lc-btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                          >
                            Выставить счёт
                          </button>
                        )}
                        {p.has_invoice && p.status !== "paid" && p.id && (
                          <button
                            type="button"
                            onClick={() => markPaid(p.id!)}
                            className="lc-btn lc-btn-primary px-3 py-1.5 text-xs"
                          >
                            Получил наличные
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {pagination.total_pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                <p className="text-sm text-slate-500">
                  Страница {pagination.page} из {pagination.total_pages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="lc-btn px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    ← Назад
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.total_pages || loading}
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
          </div>
        </>
      )}
    </AdminSubLayout>
  );
}