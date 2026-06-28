"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InstallBanner } from "@/components/mobile/InstallBanner";

export default function StudentLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/students/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_code: code, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка входа");
      return;
    }
    router.push("/student/dashboard");
  }

  return (
    <div className="min-h-dvh bg-zinc-50">
      <main className="safe-top safe-bottom mx-auto max-w-lg px-4 py-8">
        <Link href="/app" className="text-sm text-indigo-600">
          ← Назад
        </Link>

        <div className="mt-6">
          <p className="text-sm font-semibold text-emerald-600">Ученик</p>
          <h1 className="text-2xl font-bold text-zinc-900">Вход</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Код STU-2026-XXXXXX и пароль от центра
          </p>
        </div>

        <div className="mt-6">
          <InstallBanner />
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Код
          </label>
          <input
            required
            placeholder="STU-2026-XXXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="username"
            className="mb-4 w-full rounded-xl border border-zinc-300 px-4 py-3 font-mono uppercase"
          />
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Пароль
          </label>
          <input
            required
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mb-4 w-full rounded-xl border border-zinc-300 px-4 py-3"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </form>
      </main>
    </div>
  );
}