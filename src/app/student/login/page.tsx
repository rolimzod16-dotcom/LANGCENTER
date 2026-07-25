"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginLayout } from "@/components/layout/LoginLayout";
import {
  readRememberedCode,
  saveRememberedCode,
} from "@/lib/auth/remember-login";

export default function StudentLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = readRememberedCode("student");
    if (saved) setCode(saved);

    fetch("/api/student/me", { credentials: "same-origin" }).then((res) => {
      if (res.ok) router.replace("/student/dashboard");
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/students/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ student_code: code, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка входа");
      return;
    }
    saveRememberedCode("student", code);
    router.push("/student/dashboard");
  }

  return (
    <LoginLayout
      role="student"
      title="Вход ученика"
      subtitle="Логин и пароль, которые вы указали при регистрации"
    >
      <form onSubmit={handleSubmit} className="lc-card p-6">
        <label className="lc-label">Логин</label>
        <input
          required
          placeholder="Ваш логин"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="username"
          className="lc-input mb-4 font-mono uppercase"
        />
        <label className="lc-label">Пароль</label>
        <input
          required
          type="password"
          placeholder="Ваш пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="lc-input mb-5"
        />
        <button
          type="submit"
          disabled={loading}
          className="lc-btn lc-btn-student w-full py-3.5"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
        {error && <p className="lc-alert lc-alert-error mt-4">{error}</p>}
      </form>

      <div className="mt-6 space-y-3 text-center text-sm">
        <p className="text-slate-500">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-semibold text-emerald-700 hover:underline"
          >
            Записаться на курс
          </Link>
        </p>
        <p className="text-slate-400">
          Забыли пароль? Обратитесь в центр — администрация видит ваш логин и
          пароль и поможет восстановить доступ.
        </p>
        <p>
          <Link href="/app" className="font-medium text-indigo-600 hover:underline">
            Скачать приложение →
          </Link>
        </p>
      </div>
    </LoginLayout>
  );
}
