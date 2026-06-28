"use client";

import { useEffect, useState } from "react";
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

  const load = async () => {
    const [tRes, sRes] = await Promise.all([
      fetch("/api/teachers"),
      fetch("/api/students"),
    ]);
    const tData = await tRes.json();
    const sData = await sRes.json();
    if (tRes.ok) setTeachers(tData.teachers ?? []);
    if (sRes.ok) {
      setStudents(
        (sData.students ?? []).map(
          (s: {
            id: string;
            first_name: string;
            last_name: string;
            student_code: string;
            phone: string | null;
            teacher_name?: string | null;
            start_date?: string | null;
            payment_due_day?: number | null;
          }) => ({
            id: s.id,
            full_name: `${s.last_name} ${s.first_name}`.trim(),
            student_code: s.student_code,
            phone: s.phone,
            teacher_name: s.teacher_name ?? undefined,
            start_date: s.start_date ?? null,
            payment_due_day: s.payment_due_day ?? null,
          }),
        ),
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

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

        <h2 className="mb-2 text-lg font-bold text-slate-900">
          Список ({students.length})
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Код виден всегда. Пароль зашифрован — только сброс.
        </p>
        <ul className="space-y-2">
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
        {students.length === 0 && (
          <p className="lc-card-flat p-4 text-center text-slate-500">
            Пока нет учеников
          </p>
        )}
    </AdminSubLayout>
  );
}