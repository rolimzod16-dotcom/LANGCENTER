"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrgSwitcher } from "@/components/admin/OrgSwitcher";
import { AppShell } from "@/components/layout/AppShell";
import { formatMoney } from "@/lib/money";

type Dashboard = {
  teachers_active: number;
  students_active: number;
  today_income: number;
  today_payments: number;
  month_income: number;
  month_debt: number;
  month_debtors: number;
  month_payroll: number;
  month_net_profit: number;
  month_new_without_invoice: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owner/dashboard")
      .then(async (res) => {
        if (!res.ok) return;
        setStats(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <AppShell
      title="Панель владельца"
      subtitle="Сводка, ученики, учителя и финансы"
    >
      <div className="mb-6 max-w-sm">
        <OrgSwitcher />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lc-card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Учителя
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "…" : (stats?.teachers_active ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">активных</p>
        </div>
        <div className="lc-card border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ученики
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "…" : (stats?.students_active ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">активных</p>
        </div>
        <div className="lc-card border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Сегодня получено
          </p>
          <p className="mt-2 text-2xl font-bold text-violet-700">
            {loading ? "…" : formatMoney(stats?.today_income ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {stats?.today_payments ?? 0} платежей
          </p>
        </div>
        <div className="lc-card border-red-100 bg-gradient-to-br from-red-50 to-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Должники
          </p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {loading ? "…" : formatMoney(stats?.month_debt ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {stats?.month_debtors ?? 0} учеников
          </p>
        </div>
      </div>

      {!loading && stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="lc-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Месяц: получено
            </p>
            <p className="mt-2 text-xl font-bold text-emerald-700">
              {formatMoney(stats.month_income)}
            </p>
          </div>
          <div className="lc-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              ЗП учителей (50%)
            </p>
            <p className="mt-2 text-xl font-bold text-amber-700">
              {formatMoney(stats.month_payroll)}
            </p>
          </div>
          <div className="lc-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Чистая прибыль
            </p>
            <p className="mt-2 text-xl font-bold text-violet-700">
              {formatMoney(stats.month_net_profit)}
            </p>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/admin/reports"
          className="lc-btn lc-btn-primary px-4 py-2.5 text-sm"
        >
          Отчёт за сегодня
        </Link>
        <Link
          href="/admin/reports?filter=debt"
          className="lc-btn border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800"
        >
          Список должников
        </Link>
        <Link
          href="/admin/assign"
          className="lc-btn lc-btn-ghost px-4 py-2.5 text-sm"
        >
          Назначить ученика
        </Link>
      </div>

      <Link
        href="/admin/reports"
        className="lc-link-card mb-8 block border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-8"
      >
        <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
          Финансы
        </span>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">
          Отчёт владельца
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
          Наличные, должники, ЗП учителей 50%, чистая прибыль. Скачивание в Excel.
        </p>
        <p className="mt-6 font-semibold text-violet-600">Открыть отчёт →</p>
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/admin/teachers"
          className="lc-link-card group border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-8"
        >
          <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            Учителя
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            Управление учителями
          </h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            Создать учителя, код TCH-..., сброс пароля, копирование данных.
          </p>
          <p className="mt-6 font-semibold text-indigo-600 group-hover:underline">
            Перейти →
          </p>
        </Link>

        <Link
          href="/admin/students"
          className="lc-link-card group border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8"
        >
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
            Ученики
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            Управление учениками
          </h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            Добавить ученика, привязать к учителю, фильтры по оплате, поиск.
          </p>
          <p className="mt-6 font-semibold text-emerald-600 group-hover:underline">
            Перейти →
          </p>
        </Link>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={logout}
          className="lc-btn lc-btn-ghost px-4 py-2 text-sm"
        >
          Выйти из админки
        </button>
      </div>

      {stats && stats.month_new_without_invoice > 0 && (
        <div className="lc-alert lc-alert-error mt-6">
          {stats.month_new_without_invoice} новых учеников без счёта за месяц —{" "}
          <Link href="/admin/reports" className="font-semibold underline">
            выставить в отчёте
          </Link>
        </div>
      )}
    </AppShell>
  );
}