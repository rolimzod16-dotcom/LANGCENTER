"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginLayout } from "@/components/layout/LoginLayout";

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
    <LoginLayout
      role="teacher"
      title="Вход"
      subtitle="Код TCH-2026-XXXXXX и пароль от администратора"
    >
      <form onSubmit={handleSubmit} className="lc-card p-6">
        <label className="lc-label">Код учителя</label>
        <input
          required
          placeholder="TCH-2026-XXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="username"
          className="lc-input mb-4 font-mono uppercase"
        />
        <label className="lc-label">Пароль</label>
        <input
          required
          type="password"
          placeholder="Введите пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="lc-input mb-5"
        />
        <button
          type="submit"
          disabled={loading}
          className="lc-btn lc-btn-primary w-full py-3.5"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
        {error && (
          <p className="lc-alert lc-alert-error mt-4">{error}</p>
        )}
      </form>
    </LoginLayout>
  );
}