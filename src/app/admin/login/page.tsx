"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Ошибка входа");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="lc-page safe-top safe-bottom min-h-dvh">
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="text-center">
          <Logo size="md" className="mx-auto" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-violet-600">
            Только для администратора
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Вход в админ-панель
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Учителя и ученики сюда не заходят — только владелец центра
          </p>
        </div>

        <form onSubmit={handleSubmit} className="lc-card mt-8 p-6">
          <label className="lc-label">Пароль администратора</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            className="lc-input mb-5"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="lc-btn lc-btn-primary w-full py-3.5 disabled:opacity-60"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
          {error && <p className="lc-alert lc-alert-error mt-4">{error}</p>}
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Учитель?{" "}
          <Link href="/teacher/login" className="font-medium text-indigo-600">
            Вход учителя
          </Link>
          <br />
          Ученик?{" "}
          <Link href="/student/login" className="font-medium text-emerald-600">
            Вход ученика
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}