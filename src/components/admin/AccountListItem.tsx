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
    <li className="lc-card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{name}</p>
        <p className="mt-1 font-mono text-sm text-indigo-600">
          {code}
          <button
            type="button"
            onClick={copyCode}
            className="ml-2 text-xs font-semibold text-slate-500 hover:text-indigo-600"
          >
            Копировать
          </button>
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onResetPassword}
        disabled={resetting}
        className="lc-btn lc-btn-warning shrink-0 px-4 py-2 text-sm disabled:opacity-50"
      >
        {resetting ? "…" : "Новый пароль"}
      </button>
    </li>
  );
}