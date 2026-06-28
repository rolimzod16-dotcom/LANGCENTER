"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone);
    setIsStandalone(!!standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed) return null;

  if (deferredPrompt) {
    return (
      <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="font-medium text-indigo-900">Установить приложение</p>
        <p className="mt-1 text-sm text-indigo-700">
          Добавьте Lang Center на главный экран — будет открываться как обычное
          приложение.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await deferredPrompt.prompt();
              setDeferredPrompt(null);
            }}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Установить
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-xl px-4 py-2 text-sm text-indigo-700"
          >
            Позже
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
      <p className="font-medium text-zinc-900">Как установить на телефон</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <strong>iPhone:</strong> Safari → Поделиться → «На экран Домой»
        </li>
        <li>
          <strong>Android:</strong> Chrome → меню ⋮ → «Установить приложение»
        </li>
      </ul>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-3 text-indigo-600"
      >
        Понятно
      </button>
    </div>
  );
}