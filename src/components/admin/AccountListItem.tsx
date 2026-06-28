"use client";

type Props = {
  name: string;
  code: string;
  subtitle?: string;
  onResetPassword: () => void;
  resetting?: boolean;
};

export function AccountListItem({
  name,
  code,
  subtitle,
  onResetPassword,
  resetting,
}: Props) {
  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{name}</p>
        <p className="font-mono text-sm text-gray-600">
          Код: {code}
          <button
            type="button"
            onClick={copyCode}
            className="ml-2 text-xs text-blue-600 underline"
          >
            Копировать
          </button>
        </p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onResetPassword}
        disabled={resetting}
        className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        {resetting ? "…" : "Новый пароль"}
      </button>
    </li>
  );
}