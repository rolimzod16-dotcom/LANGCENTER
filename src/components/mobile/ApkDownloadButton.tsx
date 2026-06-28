"use client";

import { useState } from "react";
import { APK_DOWNLOAD_PATH, APK_FILE_NAME, APK_SIZE_MB } from "@/lib/apk-download";

type Props = {
  variant?: "primary" | "compact";
};

export function ApkDownloadButton({ variant = "primary" }: Props) {
  const [showHint, setShowHint] = useState(false);

  function startDownload() {
    setShowHint(false);
    const link = document.createElement("a");
    link.href = APK_DOWNLOAD_PATH;
    link.download = APK_FILE_NAME;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const buttonClass =
    variant === "compact"
      ? "lc-btn inline-flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm"
      : "lc-link-card flex w-full items-center gap-4 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-5 text-left";

  return (
    <>
      <button type="button" onClick={() => setShowHint(true)} className={buttonClass}>
        {variant === "compact" ? (
          <>
            <span>📥</span>
            Скачать APK ({APK_SIZE_MB} МБ)
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-2xl text-white shadow-md shadow-emerald-200">
              📥
            </span>
            <div>
              <p className="font-bold text-emerald-900">Скачать для Android</p>
              <p className="text-sm text-emerald-700">
                APK {APK_SIZE_MB} МБ — бесплатно
              </p>
            </div>
          </>
        )}
      </button>

      {showHint && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="apk-hint-title"
        >
          <div className="lc-card max-w-md w-full p-5 shadow-xl">
            <p id="apk-hint-title" className="text-lg font-bold text-slate-900">
              Перед загрузкой
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Телефон может показать предупреждение «файл может быть опасным».
              Это нормально для приложений{" "}
              <strong>не из Google Play</strong> — Lang Center безопасен.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
              <li>
                Нажмите <strong>«Загрузить всё равно»</strong> или{" "}
                <strong>«Download anyway»</strong>
              </li>
              <li>Откройте файл в папке «Загрузки»</li>
              <li>
                При установке разрешите «Неизвестные приложения» для браузера
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">
              Без предупреждения: установите через Chrome → ⋮ → «Установить
              приложение» на странице /app
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={startDownload}
                className="lc-btn lc-btn-student flex-1 px-4 py-2.5"
              >
                Понятно, скачать
              </button>
              <button
                type="button"
                onClick={() => setShowHint(false)}
                className="lc-btn px-4 py-2.5 text-slate-600"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}