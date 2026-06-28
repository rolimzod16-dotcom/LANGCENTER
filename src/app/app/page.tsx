import Link from "next/link";
import { ApkDownloadButton } from "@/components/mobile/ApkDownloadButton";
import { InstallBanner } from "@/components/mobile/InstallBanner";

export default function MobileAppPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-indigo-50 to-zinc-50">
      <main className="safe-top safe-bottom mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-3xl font-bold text-white shadow-lg">
            LC
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Lang Center</h1>
          <p className="mt-2 text-zinc-600">
            Кабинет учителя и ученика на телефоне
          </p>
        </div>

        <ApkDownloadButton />

        <div className="my-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          <p className="font-medium text-zinc-900">Как установить APK</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Нажмите «Скачать для Android»</li>
            <li>Откройте скачанный файл</li>
            <li>Разрешите установку, если телефон спросит</li>
            <li>Готово — откройте Lang Center</li>
          </ol>
        </div>

        <InstallBanner />

        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-zinc-400">
          или войти в браузере
        </p>

        <div className="space-y-3">
          <Link
            href="/teacher/login"
            className="flex items-center gap-4 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm transition active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-2xl">
              👨‍🏫
            </span>
            <div>
              <p className="font-semibold text-zinc-900">Я учитель</p>
              <p className="text-sm text-zinc-500">
                Ученики, посещаемость, оценки
              </p>
            </div>
          </Link>

          <Link
            href="/student/login"
            className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-2xl">
              🎓
            </span>
            <div>
              <p className="font-semibold text-zinc-900">Я ученик</p>
              <p className="text-sm text-zinc-500">
                Оценки, посещаемость, учителя
              </p>
            </div>
          </Link>
        </div>

        <p className="mt-auto pt-8 text-center text-xs text-zinc-400">
          Админ-панель — только с компьютера:{" "}
          <Link href="/admin" className="text-indigo-600 underline">
            /admin
          </Link>
        </p>
      </main>
    </div>
  );
}