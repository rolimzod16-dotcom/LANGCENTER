"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApkDownloadButton } from "@/components/mobile/ApkDownloadButton";
import { InstallBanner } from "@/components/mobile/InstallBanner";
import { Logo } from "@/components/ui/Logo";

type SessionHint = "teacher" | "student" | null;

export default function MobileAppPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionHint>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/teacher/me", { credentials: "same-origin" }),
      fetch("/api/student/me", { credentials: "same-origin" }),
    ]).then(async ([teacherRes, studentRes]) => {
      if (teacherRes.ok) {
        setSession("teacher");
        router.replace("/teacher/dashboard");
        return;
      }
      if (studentRes.ok) {
        setSession("student");
        router.replace("/student/dashboard");
        return;
      }
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="lc-page safe-top safe-bottom flex min-h-dvh items-center justify-center">
        <p className="text-slate-500">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="lc-page safe-top safe-bottom flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
        <div className="text-center">
          <Logo size="lg" className="mx-auto" />
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Lang Center</h1>
          <p className="mt-2 text-slate-500">
            Кабинет учителя и ученика на телефоне
          </p>
        </div>

        <div className="mt-8">
          <InstallBanner />
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            или скачать APK
          </p>
          <ApkDownloadButton />
          <Link
            href="/download"
            className="block text-center text-sm font-medium text-indigo-600 hover:underline"
          >
            Инструкция по установке →
          </Link>
        </div>

        <p className="mt-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Войти
        </p>

        <div className="mt-4 space-y-3">
          <Link
            href="/teacher/login"
            className="lc-link-card flex items-center gap-4 p-5"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl">
              👨‍🏫
            </span>
            <div>
              <p className="font-bold text-slate-900">Я учитель</p>
              <p className="text-sm text-slate-500">
                Ученики, посещаемость, оценки
              </p>
            </div>
          </Link>

          <Link
            href="/student/login"
            className="lc-link-card flex items-center gap-4 border-emerald-100 p-5"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
              🎓
            </span>
            <div>
              <p className="font-bold text-slate-900">Я ученик</p>
              <p className="text-sm text-slate-500">
                Оплата, оценки, посещаемость
              </p>
            </div>
          </Link>
        </div>

        <p className="mt-auto pt-10 text-center text-xs text-slate-400">
          Админ-панель:{" "}
          <Link href="/admin/login" className="font-medium text-violet-600">
            вход владельца
          </Link>
        </p>
      </main>
    </div>
  );
}