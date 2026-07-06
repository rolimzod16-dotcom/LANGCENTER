"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/mobile/MobileShell";
import { formatMoney } from "@/lib/payments";

const TABS = [
  { id: "home", label: "Главная", icon: "🏠" },
  { id: "grades", label: "Оценки", icon: "📊" },
  { id: "attendance", label: "Визиты", icon: "📅" },
];

const statusLabel: Record<string, string> = {
  present: "✅ Присутствовал",
  absent: "❌ Отсутствовал",
  late: "⏰ Опоздал",
};

const paymentStatusLabel: Record<string, string> = {
  paid: "Оплачено",
  pending: "Ожидает оплаты",
  partial: "Частично оплачено",
  overdue: "Просрочено",
};

function formatDateRu(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

type PaymentInfo = {
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: string;
  debt: number;
  has_invoice: boolean;
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    student: { full_name: string; student_code: string };
    teachers: { teacher_name: string; group_name: string }[];
    grades: {
      title: string;
      score: number;
      max_score: number;
      teacher_name: string;
      graded_at: string;
    }[];
    attendance: {
      lesson_date: string;
      status: string;
      teacher_name: string;
    }[];
    payment: PaymentInfo | null;
  } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/student/me", { credentials: "same-origin" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      router.push("/student/login");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    load();
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/app");
  }

  if (!data) {
    return (
      <MobileShell title="Кабинет ученика" subtitle="Загрузка...">
        <p className="text-center text-slate-500">Загрузка...</p>
      </MobileShell>
    );
  }

  const payment = data.payment;
  const paymentKey = !payment?.has_invoice ? "new" : payment?.status;

  return (
    <MobileShell
      title="Кабинет ученика"
      subtitle={`${data.student.full_name} · ${data.student.student_code}`}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      onRefresh={load}
      refreshing={loading}
    >
      {tab === "home" && (
        <section className="space-y-4">
          <div className="lc-card border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ваш код
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-600">
              {data.student.student_code}
            </p>
          </div>

          {payment && (
            <div
              className={`lc-card p-5 ${
                payment.status === "paid"
                  ? "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white"
                  : payment.status === "overdue"
                    ? "border-red-100 bg-gradient-to-br from-red-50 to-white"
                    : "border-amber-100 bg-gradient-to-br from-amber-50 to-white"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Оплата за месяц
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {paymentStatusLabel[paymentKey] ?? payment.status}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                К оплате: {formatMoney(payment.amount_due)}
              </p>
              {payment.amount_paid > 0 && (
                <p className="text-sm text-emerald-700">
                  Оплачено: {formatMoney(payment.amount_paid)}
                </p>
              )}
              {payment.debt > 0 && payment.status !== "paid" && (
                <p className="text-sm font-semibold text-red-700">
                  Долг: {formatMoney(payment.debt)}
                </p>
              )}
              <p className="mt-2 text-sm text-slate-500">
                Срок: {formatDateRu(payment.due_date)}
              </p>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-slate-900">Мои учителя</h2>
            {data.teachers.length === 0 ? (
              <p className="lc-card-flat mt-3 p-4 text-center text-sm text-slate-500">
                Пока не назначены
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.teachers.map((t, i) => (
                  <li key={i} className="lc-card p-4">
                    <p className="font-bold text-slate-900">{t.teacher_name}</p>
                    <p className="text-sm text-slate-500">
                      Группа: {t.group_name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="lc-btn lc-btn-ghost w-full py-3.5"
          >
            Выйти
          </button>
        </section>
      )}

      {tab === "grades" && (
        <section>
          <h2 className="text-lg font-bold text-slate-900">Оценки</h2>
          {data.grades.length === 0 ? (
            <p className="lc-card-flat mt-4 p-4 text-center text-sm text-slate-500">
              Пока нет оценок
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.grades.map((g, i) => (
                <li
                  key={i}
                  className="lc-card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4"
                >
                  <p className="font-bold text-slate-900">{g.title}</p>
                  <p className="mt-2 text-3xl font-bold text-indigo-600">
                    {g.score}
                    <span className="text-base font-normal text-slate-500">
                      {" "}
                      / {g.max_score}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">{g.teacher_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatDateRu(g.graded_at.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "attendance" && (
        <section>
          <h2 className="text-lg font-bold text-slate-900">Посещаемость</h2>
          {data.attendance.length === 0 ? (
            <p className="lc-card-flat mt-4 p-4 text-center text-sm text-slate-500">
              Пока нет отметок
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.attendance.map((a, i) => (
                <li key={i} className="lc-card p-4">
                  <p className="font-bold text-slate-900">
                    {formatDateRu(a.lesson_date)}
                  </p>
                  <p className="mt-1 text-sm">
                    {statusLabel[a.status] ?? a.status}
                  </p>
                  <p className="text-sm text-zinc-500">{a.teacher_name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </MobileShell>
  );
}