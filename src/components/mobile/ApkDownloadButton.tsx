import { APK_DOWNLOAD_PATH, APK_SIZE_MB } from "@/lib/apk-download";

type Props = {
  variant?: "primary" | "compact";
};

export function ApkDownloadButton({ variant = "primary" }: Props) {
  if (variant === "compact") {
    return (
      <a
        href={APK_DOWNLOAD_PATH}
        className="lc-btn inline-flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm"
      >
        <span>📥</span>
        Скачать APK ({APK_SIZE_MB} МБ)
      </a>
    );
  }

  return (
    <a
      href={APK_DOWNLOAD_PATH}
      className="lc-link-card flex items-center gap-4 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-5"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-2xl text-white shadow-md shadow-emerald-200">
        📥
      </span>
      <div>
        <p className="font-bold text-emerald-900">Скачать для Android</p>
        <p className="text-sm text-emerald-700">
          APK {APK_SIZE_MB} МБ — бесплатно
        </p>
      </div>
    </a>
  );
}