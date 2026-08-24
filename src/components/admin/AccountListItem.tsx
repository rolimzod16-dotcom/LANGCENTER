"use client";

type Props = {
  name: string;
  code: string;
  password?: string | null;
  subtitle?: string;
  onResetPassword: () => void;
  resetting?: boolean;
};

export function AccountListItem({
  name,
  code,
  password,
  subtitle,
  onResetPassword,
  resetting,
}: Props) {
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  return (
    <li className="lc-card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{name}</p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        )}
        <div className="mt-2 grid gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm sm:max-w-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Логин
            </span>
            <span className="font-mono font-bold text-indigo-700">{code}</span>
            <button
              type="button"
              onClick={() => copy(code)}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Копировать
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Пароль
            </span>
            {password ? (
              <>
                <span className="font-mono font-bold text-slate-900">
                  {password}
                </span>
                <button
                  type="button"
                  onClick={() => copy(password)}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Копировать
                </button>
                <button
                  type="button"
                  onClick={() => copy(`Логин: ${code}\nПароль: ${password}`)}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Логин + пароль
                </button>
              </>
            ) : (
              <span className="text-xs text-amber-700">
                Не сохранён — нажми «Новый пароль», дальше будет виден
              </span>
            )}
          </div>
        </div>
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