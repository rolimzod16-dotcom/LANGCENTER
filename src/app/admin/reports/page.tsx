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
  start_date: string | null;
  status: string;
  has_invoice: boolean;
};

type Summary = {
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
};

type Filter = "all" | "paid" | "debt" | "overdue" | "new";

const STATUS: Record<string, { label: string; className: string }> = {
  paid: { label: "Оплачено", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Ожидает", className: "bg-slate-100 text-slate-700" },
  partial: { label: "Частично", className: "bg-amber-100 text-amber-800" },
  overdue: { label: "Должен", className: "bg-red-100 text-red-800" },
  new: { label: "Новый", className: "bg-blue-100 text-blue-800" },
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "debt", label: "Должники" },
  { id: "overdue", label: "Просрочено" },
  { id: "paid", label: "Оплачено" },
  { id: "new", label: "Новые" },
];

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 350;

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

function secondsAgo(iso: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "только что";
  if (diff < 60) return `${diff} сек назад`;
  const mins = Math.floor(diff / 60);
  return `${mins} мин назад`;
}

export default function OwnerReportsPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    total_pages: 1,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ensuringId, setEnsuringId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loadSummary = useCallback(
    async (silent = false) => {
      if (!silent) setSummaryLoading(true);
      const period = `${month}-01`;
      const res = await fetch(`/api/owner/reports?month=${period}&summary_only=1`);
      const data = await res.json();
      if (!silent) setSummaryLoading(false);
      if (!res.ok) {
        if (!silent) setError(data.error ?? "Ошибка загрузки");
        return;
      }
      setSummary(data.summary);
      setLastUpdated(data.updated_at ?? new Date().toISOString());
      setError("");
    },
    [month],
  );

  const loadList = useCallback(
    async (silent = false) => {
      if (!silent) setListLoading(true);
      const period = `${month}-01`;
      const params = new URLSearchParams({
        month: period,
        page: String(page),
        limit: String(PAGE_SIZE),
        filter,
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/owner/reports?${params}`);
      const data = await res.json();
      if (!silent) setListLoading(false);
      if (!res.ok) {
        if (!silent) setError(data.error ?? "Ошибка загрузки списка");
        return;
      }
      setPayments(data.payments ?? []);
      setPagination(
        data.pagination ?? {
          total: 0,
          page: 1,
          limit: PAGE_SIZE,
          total_pages: 1,
        },
      );
      setError("");
    },
    [month, page, filter, search],
  );

  const refreshAll = useCallback(
    async (silent = false) => {
      await Promise.all([loadSummary(silent), loadList(silent)]);
    },
    [loadSummary, loadList],
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const poll = setInterval(() => loadSummary(true), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [loadSummary]);

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
  }, [filter, month]);

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
    await refreshAll();
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/payments/${id}/pay`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Ошибка");
      return;
    }
    await refreshAll(true);
  }

  async function ensureInvoice(studentId: string) {
    setEnsuringId(studentId);
    const res = await fetch("/api/payments/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, month: `${month}-01` }),
    });
    const data = await res.json();
    setEnsuringId(null);
    if (!res.ok) {
      alert(data.error ?? "Ошибка");
      return;
    }
    await refreshAll(true);
  }

  const s = summary;
  void tick;

  return (
    <AdminSubLayout
      title="Отчёт владельца"
      description="Учёт наличных оплат. Сводка обновляется автоматически, список — по 50 учеников за раз."
    >
      <div className="mb-6 flex flex-wrap items-end gap-4">
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
        <Link href="/admin" className="lc-btn lc-btn-ghost px-4 py-2.5 text-sm">
          ← Панель
        </Link>
        {lastUpdated && (
          <p className="text-sm text-slate-500">
            Сводка: {secondsAgo(lastUpdated)}
          </p>
        )}
      </div>

      {error && (
        <div className="lc-alert lc-alert-error mb-6">
          {error}
          {error.includes("student_payments") && (
            <p className="mt-2 text-sm">
              Запустите <code className="rounded bg-red-100 px-1">supabase/PAYMENTS.sql</code> в Supabase SQL Editor
            </p>
          )}
        </div>
      )}

      {summaryLoading && !s && (
        <p className="text-slate-500">Загрузка сводки…</p>
      )}

      {s && (
        <>
          <p className="mb-4 text-sm font-medium text-violet-700">
            Период: {monthLabel(month)}
            {s.new_count > 0 && (
              <span className="ml-2 text-blue-600">
                · {s.new_count} новых без счёта
              </span>
            )}
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lc-card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Учеников в отчёте
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {s.billing_count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                активных в базе: {s.active_students} · всего: {s.total_students}
              </p>
            </div>

            <div className="lc-card border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Получено наличными
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {formatMoney(s.total_income)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                из {formatMoney(s.total_expected)} ожидалось
              </p>
            </div>

            <div className="lc-card border-red-100 bg-gradient-to-br from-red-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Должны
              </p>
              <p className="mt-2 text-2xl font-bold text-red-700">
                {formatMoney(s.total_debt)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {s.debt_count} учеников · {s.overdue_count} просрочено
              </p>
            </div>

            <div className="lc-card border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Прибыль
              </p>
              <p className="mt-2 text-2xl font-bold text-violet-700">
                {formatMoney(s.profit)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                расходы на учителей — позже
              </p>
            </div>
          </div>

          <div className="lc-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Оплаты учеников ({pagination.total})
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Показано {payments.length} из {pagination.total} · по {PAGE_SIZE} на страницу
                  </p>
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
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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

            {listLoading && payments.length === 0 ? (
              <p className="p-6 text-center text-slate-500">Загрузка списка…</p>
            ) : payments.length === 0 ? (
              <p className="p-6 text-center text-slate-500">
                Ничего не найдено. Измените фильтр или поиск.
              </p>
            ) : (
              <ul className={`divide-y divide-slate-100 ${listLoading ? "opacity-60" : ""}`}>
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
                        <p className="font-semibold text-slate-900">
                          {p.student_name}
                        </p>
                        <p className="font-mono text-xs text-indigo-600">
                          {p.student_code}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Старт: {formatDateRu(p.start_date)} · Срок:{" "}
                          {formatDateRu(p.due_date)} · {formatMoney(p.amount_due)}
                          {p.amount_paid > 0 && (
                            <span className="text-emerald-600">
                              {" "}
                              · оплачено {formatMoney(p.amount_paid)}
                            </span>
                          )}
                          {debt > 0 && p.status !== "paid" && (
                            <span className="text-red-600">
                              {" "}
                              · долг {formatMoney(debt)}
                            </span>
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
                            onClick={() => ensureInvoice(p.student_id)}
                            disabled={ensuringId === p.student_id}
                            className="lc-btn lc-btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                          >
                            {ensuringId === p.student_id
                              ? "Создание…"
                              : "Выставить счёт"}
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
          </div>
        </>
      )}
    </AdminSubLayout>
  );
}