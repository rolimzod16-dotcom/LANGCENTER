import Link from "next/link";
import { ApkDownloadButton } from "@/components/mobile/ApkDownloadButton";
import { APK_DOWNLOAD_PATH, APK_SIZE_MB } from "@/lib/apk-download";

export default function DownloadPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-green-50 to-zinc-50">
      <main className="safe-top safe-bottom mx-auto max-w-lg px-4 py-10">
        <Link href="/app" className="text-sm text-indigo-600">
          ← Назад
        </Link>

        <div className="mt-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-green-600 text-3xl font-bold text-white">
            📥
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Скачать Lang Center
          </h1>
          <p className="mt-2 text-zinc-600">
            Приложение для Android — учителя и ученики
          </p>
        </div>

        <div className="mt-8">
          <ApkDownloadButton />
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">Инструкция</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Нажмите зелёную кнопку выше</li>
            <li>Дождитесь загрузки ({APK_SIZE_MB} МБ)</li>
            <li>Откройте файл в папке «Загрузки»</li>
            <li>Разрешите установку, если телефон спросит</li>
            <li>Откройте приложение Lang Center</li>
          </ol>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Прямая ссылка:{" "}
          <a href={APK_DOWNLOAD_PATH} className="text-indigo-600 underline">
            {APK_DOWNLOAD_PATH}
          </a>
        </p>
      </main>
    </div>
  );
}