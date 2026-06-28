"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminSubLayout } from "@/components/layout/AdminSubLayout";
import { formatMoney } from "@/lib/payments";

type Payment = {
  id: string;
  student_name: string;
  student_code: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: string;
};

type Report = {
  period_month: string;
  summary: {
    total_students: number;
    active_students: number;
    total_income: number;
    total_expected: number;
    total_debt: number;
    profit: number;
    paid_count: number;
    debt_count: number;
    overdue_count: number;
  };
  payments: Payment[];
};

const STATUS: Record<string, { label: string; className: string }> = {
  paid: { label: "Оплачено", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Ожидает", className: "bg-slate-100 text-slate-700" },
  partial: { label: "Частично", className: "bg-amber-100 text-amber-800" },
  overdue: { label: "Должен", className: "bg-red-100 text-red-800" },
};

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  return `${months[Number(m) - 1]} ${y}`;
}

export default function OwnerReportsPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const period = `${month}-01`;
    const res = await fetch(`/api/owner/reports?month=${period}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка загрузки");
      return;
    }
    setReport(data);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

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
    load();
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/payments/${id}/pay`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Ошибка");
      return;
    }
    load();
  }

  const s = report?.summary;

  return (
    <AdminSubLayout
      title="Отчёт владельца"
      description="Учёт наличных оплат в центре — кто заплатил, кто должен, доход и прибыль. Онлайн-оплаты нет."
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

      {loading && <p className="text-slate-500">Загрузка отчёта…</p>}

      {s && !loading && (
        <>
          <p className="mb-4 text-sm font-medium text-violet-700">
            Период: {monthLabel(month)}
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lc-card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Учеников
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {s.active_students}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                всего в базе: {s.total_students}
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
              <h2 className="font-bold text-slate-900">
                Оплаты учеников ({report.payments.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Зелёный — оплатил · Красный — должен · Дата — срок оплаты
              </p>
            </div>

            {report.payments.length === 0 ? (
              <p className="p-6 text-center text-slate-500">
                Нет записей за этот месяц. Нажмите «Выставить оплату за месяц».
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.payments.map((p) => {
                  const st = STATUS[p.status] ?? STATUS.pending;
                  const debt = Math.max(0, p.amount_due - p.amount_paid);
                  return (
                    <li
                      key={p.id}
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
                          Срок: {p.due_date} · {formatMoney(p.amount_due)}
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
                        {p.status !== "paid" && (
                          <button
                            type="button"
                            onClick={() => markPaid(p.id)}
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
          </div>
        </>
      )}
    </AdminSubLayout>
  );
}