import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

export default function AdminPage() {
  return (
    <AppShell
      title="Панель администратора"
      subtitle="Два простых шага — сначала учителя, потом ученики"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/admin/teachers"
          className="group rounded-2xl border-2 border-indigo-200 bg-white p-8 shadow-sm transition hover:border-indigo-400 hover:shadow-md"
        >
          <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">
            Шаг 1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            Добавить учителя
          </h2>
          <p className="mt-3 text-zinc-600">
            Создай учителя, получи код TCH-... и пароль. В списке виден код,
            пароль можно сбросить. Без учителя учеников добавить нельзя.
          </p>
          <p className="mt-6 font-medium text-indigo-600 group-hover:underline">
            Перейти →
          </p>
        </Link>

        <Link
          href="/admin/students"
          className="group rounded-2xl border-2 border-emerald-200 bg-white p-8 shadow-sm transition hover:border-emerald-400 hover:shadow-md"
        >
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-600">
            Шаг 2
          </p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            Добавить ученика
          </h2>
          <p className="mt-3 text-zinc-600">
            Выбери учителя и добавь ученика. Код STU-... виден в списке,
            пароль можно сбросить кнопкой «Новый пароль».
          </p>
          <p className="mt-6 font-medium text-emerald-600 group-hover:underline">
            Перейти →
          </p>
        </Link>
      </div>

      <div className="mt-8 rounded-xl bg-zinc-100 p-5 text-sm text-zinc-700">
        <p className="font-semibold">Порядок работы:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Шаг 1 — добавь хотя бы одного учителя</li>
          <li>Шаг 2 — добавь ученика и выбери к какому учителю он относится</li>
          <li>Учитель входит в свой кабинет и видит своих учеников</li>
          <li>Ученик входит и видит своего учителя, оценки и посещаемость</li>
        </ol>
      </div>
    </AppShell>
  );
}