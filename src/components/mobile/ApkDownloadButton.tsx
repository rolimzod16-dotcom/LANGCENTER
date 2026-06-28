import { APK_DOWNLOAD_PATH, APK_SIZE_MB } from "@/lib/apk-download";

type Props = {
  variant?: "primary" | "compact";
};

export function ApkDownloadButton({ variant = "primary" }: Props) {
  if (variant === "compact") {
    return (
      <a
        href={APK_DOWNLOAD_PATH}
        className="inline-flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800"
      >
        <span>📥</span>
        Скачать APK ({APK_SIZE_MB} МБ)
      </a>
    );
  }

  return (
    <a
      href={APK_DOWNLOAD_PATH}
      className="flex items-center gap-4 rounded-2xl border-2 border-green-400 bg-green-50 p-5 shadow-sm transition active:scale-[0.98]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500 text-2xl text-white">
        📥
      </span>
      <div>
        <p className="font-semibold text-green-900">Скачать для Android</p>
        <p className="text-sm text-green-700">
          APK {APK_SIZE_MB} МБ — установите на телефон
        </p>
      </div>
    </a>
  );
}