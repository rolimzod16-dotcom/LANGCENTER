"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/teachers/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_code: code, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка входа");
      return;
    }
    router.push("/teacher/dashboard");
  }

  return (
    <AppShell title="Вход учителя" subtitle="Код TCH-2026-XXXXXX + пароль">
      <form
        onSubmit={handleSubmit}
        className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <input
          required
          placeholder="TCH-2026-XXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono uppercase"
        />
        <input
          required
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>
      <Link href="/" className="mt-4 inline-block text-sm text-indigo-600">
        ← На главную
      </Link>
    </AppShell>
  );
}