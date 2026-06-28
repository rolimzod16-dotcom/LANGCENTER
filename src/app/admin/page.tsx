"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default function AdminPage() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <AppShell
      title="Панель владельца"
      subtitle="Управление центром, ученики и финансовый отчёт"
    >
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
          Наличные оплаты: сколько учеников, кто заплатил в центре, кто должен, прибыль.
        </p>
        <p className="mt-6 font-semibold text-violet-600">Открыть отчёт →</p>
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/admin/teachers"
          className="lc-link-card group border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-8"
        >
          <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            Шаг 1
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            Добавить учителя
          </h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            Создайте учителя, получите код TCH-... и пароль. В списке виден код,
            пароль можно сбросить.
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
            Шаг 2
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            Добавить ученика
          </h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            Выберите учителя и добавьте ученика. Код STU-... виден в списке,
            пароль можно сбросить.
          </p>
          <p className="mt-6 font-semibold text-emerald-600 group-hover:underline">
            Перейти →
          </p>
        </Link>
      </div>

      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={logout}
          className="lc-btn lc-btn-ghost px-4 py-2 text-sm"
        >
          Выйти из админки
        </button>
      </div>

      <div className="lc-card-flat mt-8 p-6 text-sm text-slate-600">
        <p className="font-bold text-slate-900">Порядок работы</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed">
          <li>Добавьте хотя бы одного учителя</li>
          <li>Добавьте ученика и привяжите к учителю</li>
          <li>Учитель входит и видит своих учеников</li>
          <li>Ученик входит и видит оценки и посещаемость</li>
        </ol>
      </div>
    </AppShell>
  );
}