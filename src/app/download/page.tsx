import Link from "next/link";
import { ApkDownloadButton } from "@/components/mobile/ApkDownloadButton";
import { APK_DOWNLOAD_PATH, APK_SIZE_MB } from "@/lib/apk-download";
import { Logo } from "@/components/ui/Logo";

export default function DownloadPage() {
  return (
    <div className="lc-page safe-top safe-bottom min-h-dvh">
      <main className="mx-auto max-w-lg px-4 py-10">
        <Link
          href="/app"
          className="text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          ← Назад
        </Link>

        <div className="mt-8 text-center">
          <Logo size="lg" className="mx-auto" />
          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Скачать Lang Center
          </h1>
          <p className="mt-2 text-slate-500">
            Приложение для Android — учителя и ученики
          </p>
        </div>

        <div className="mt-8">
          <ApkDownloadButton />
        </div>

        <div className="lc-card mt-6 border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="font-bold">Телефон пишет «файл опасен»?</p>
          <p className="mt-2 leading-relaxed">
            Это стандартная защита Android для APK не из Google Play. Lang Center
            — ваше приложение центра. Нажмите{" "}
            <strong>«Загрузить всё равно»</strong> — файл скачивается с{" "}
            <strong>langcenter.vercel.app</strong>, не со стороннего сайта.
          </p>
        </div>

        <div className="lc-card mt-4 p-5 text-sm text-slate-600">
          <p className="font-bold text-slate-900">Инструкция</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed">
            <li>Нажмите зелёную кнопку выше</li>
            <li>Если спросит — «Загрузить всё равно»</li>
            <li>Дождитесь загрузки ({APK_SIZE_MB} МБ)</li>
            <li>Откройте файл в «Загрузках»</li>
            <li>Разрешите установку из браузера, если спросит</li>
            <li>Войдите с кодом от центра</li>
          </ol>
        </div>

        <div className="lc-card-flat mt-4 p-5 text-sm text-slate-600">
          <p className="font-bold text-indigo-900">Без предупреждения (рекомендуем)</p>
          <p className="mt-2 leading-relaxed">
            Откройте{" "}
            <Link href="/app" className="font-medium text-indigo-600 underline">
              /app
            </Link>{" "}
            в Chrome → меню ⋮ → «Установить приложение». Работает так же, без
            скачивания APK.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Ссылка:{" "}
          <a href={APK_DOWNLOAD_PATH} className="text-indigo-600 underline">
            {APK_DOWNLOAD_PATH}
          </a>
        </p>
      </main>
    </div>
  );
}