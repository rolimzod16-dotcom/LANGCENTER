"use client";

type Props = {
  title: string;
  code: string;
  password: string;
  onClose: () => void;
};

export function CredentialsCard({ title, code, password, onClose }: Props) {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="lc-card mb-6 border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-5">
      <p className="font-bold text-emerald-900">{title}</p>
      <div className="mt-4 space-y-3">
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Код
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">
            {code}
            <button
              type="button"
              onClick={() => copy(code)}
              className="ml-3 text-sm font-semibold text-indigo-600 hover:underline"
            >
              Копировать
            </button>
          </p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Пароль
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">
            {password}
            <button
              type="button"
              onClick={() => copy(password)}
              className="ml-3 text-sm font-semibold text-indigo-600 hover:underline"
            >
              Копировать
            </button>
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-emerald-800">
        Сохраните данные и передайте пользователю. Пароль больше не отобразится.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="lc-btn lc-btn-ghost mt-4 px-4 py-2 text-sm"
      >
        Закрыть
      </button>
    </div>
  );
}