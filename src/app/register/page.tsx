"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApkDownloadButton } from "@/components/mobile/ApkDownloadButton";
import { Logo } from "@/components/ui/Logo";
import { saveRememberedCode } from "@/lib/auth/remember-login";

const COURSES = [
  "English (общий / разговорный)",
  "English · IELTS",
  "Китайский",
  "Русский",
  "Türkçe",
  "Пока не знаю — помогите выбрать",
];

const SCHEDULES = [
  "Утро (09:00–12:00)",
  "День (12:00–17:00)",
  "Вечер (17:00–21:00)",
  "Выходные",
  "Гибко",
];

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [course, setCourse] = useState(COURSES[0]);
  const [schedule, setSchedule] = useState(SCHEDULES[2]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ login: string; password: string } | null>(
    null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/students/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        phone,
        login,
        password,
        preferred_course: course,
        preferred_schedule: schedule,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Не удалось зарегистрироваться");
      return;
    }

    const credLogin = data.credentials?.login ?? login.toUpperCase();
    const credPass = data.credentials?.password ?? password;
    saveRememberedCode("student", credLogin);
    setDone({ login: credLogin, password: credPass });
  }

  if (done) {
    return (
      <div className="lc-page safe-top safe-bottom min-h-dvh">
        <main className="mx-auto max-w-lg px-4 py-10">
          <div className="text-center">
            <Logo size="md" className="mx-auto" />
            <h1 className="mt-5 text-2xl font-bold text-slate-900">
              Вы записаны!
            </h1>
            <p className="mt-2 text-slate-500">
              Сохраните логин и пароль — ими вы входите в кабинет. Администрация
              тоже видит их, чтобы помочь восстановить доступ.
            </p>
          </div>

          <div className="lc-card mt-8 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Ваши данные для входа
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-white/90 p-3">
                <p className="text-xs text-slate-500">Логин</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                  {done.login}
                </p>
              </div>
              <div className="rounded-xl bg-white/90 p-3">
                <p className="text-xs text-slate-500">Пароль</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                  {done.password}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => router.push("/student/dashboard")}
              className="lc-btn lc-btn-student w-full py-3.5"
            >
              Открыть кабинет ученика →
            </button>
            <Link
              href="/app"
              className="lc-btn lc-btn-ghost w-full py-3 text-center"
            >
              Скачать приложение / на главный экран
            </Link>
            <ApkDownloadButton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="lc-page safe-top safe-bottom min-h-dvh">
      <main className="mx-auto max-w-lg px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          ← На сайт
        </Link>

        <div className="mt-6 text-center">
          <Logo size="md" className="mx-auto" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-emerald-600">
            Запись на курс
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Регистрация ученика
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Придумайте логин и пароль — ими будете входить. Или сначала скачайте
            приложение и зарегистрируйтесь там же.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="text-sm font-semibold text-indigo-900">
            Удобнее с телефона?
          </p>
          <p className="mt-1 text-sm text-indigo-800/80">
            После регистрации можно привязать кабинет в Telegram-боте ученика
            (<code className="text-xs">/login ЛОГИН пароль</code>) — оценки и
            посещаемость в чате. Либо скачайте APK / откройте в браузере.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <ApkDownloadButton variant="compact" />
            <Link
              href="/app"
              className="text-center text-sm font-semibold text-indigo-700 hover:underline"
            >
              Открыть приложение →
            </Link>
            {process.env.NEXT_PUBLIC_TG_STUDENT_BOT ? (
              <a
                href={`https://t.me/${process.env.NEXT_PUBLIC_TG_STUDENT_BOT.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-center text-sm font-semibold text-sky-700 hover:underline"
              >
                Telegram-бот ученика →
              </a>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="lc-card mt-6 space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="lc-label">Имя</label>
              <input
                required
                className="lc-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                placeholder="Али"
              />
            </div>
            <div>
              <label className="lc-label">Фамилия</label>
              <input
                required
                className="lc-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                placeholder="Рахимов"
              />
            </div>
          </div>

          <div>
            <label className="lc-label">Телефон</label>
            <input
              className="lc-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+992 90 000 00 00"
            />
          </div>

          <div>
            <label className="lc-label">Желаемый курс</label>
            <select
              className="lc-input"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="lc-label">Удобное время</label>
            <select
              className="lc-input"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            >
              {SCHEDULES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <hr className="border-slate-100" />

          <div>
            <label className="lc-label">Логин (для входа)</label>
            <input
              required
              className="lc-input font-mono uppercase"
              value={login}
              onChange={(e) =>
                setLogin(e.target.value.toUpperCase().replace(/\s/g, ""))
              }
              autoComplete="username"
              placeholder="ALI_2026"
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._@\-]{3,32}"
              title="Латиница, цифры, . _ @ -"
            />
            <p className="mt-1 text-xs text-slate-400">
              Запомните логин — его видит и администрация (для помощи).
            </p>
          </div>

          <div>
            <label className="lc-label">Пароль</label>
            <input
              required
              type="password"
              className="lc-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Минимум 6 символов"
              minLength={6}
            />
          </div>

          <div>
            <label className="lc-label">Повторите пароль</label>
            <input
              required
              type="password"
              className="lc-input"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="lc-btn lc-btn-student w-full py-3.5 disabled:opacity-60"
          >
            {loading ? "Регистрация…" : "Зарегистрироваться и записаться"}
          </button>

          {error && <p className="lc-alert lc-alert-error">{error}</p>}

          <p className="text-center text-sm text-slate-500">
            Уже есть аккаунт?{" "}
            <Link
              href="/student/login"
              className="font-semibold text-emerald-700 hover:underline"
            >
              Войти
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
