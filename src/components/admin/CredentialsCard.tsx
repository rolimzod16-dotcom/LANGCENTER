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
    <div className="mb-6 rounded-xl border-2 border-green-500 bg-green-50 p-4">
      <p className="font-semibold text-green-800">{title}</p>
      <p className="mt-2 font-mono text-lg">
        Код: <strong>{code}</strong>
        <button
          type="button"
          onClick={() => copy(code)}
          className="ml-2 text-sm text-green-700 underline"
        >
          Копировать
        </button>
      </p>
      <p className="font-mono text-lg">
        Пароль: <strong>{password}</strong>
        <button
          type="button"
          onClick={() => copy(password)}
          className="ml-2 text-sm text-green-700 underline"
        >
          Копировать
        </button>
      </p>
      <p className="mt-2 text-sm text-green-700">
        Сохраните и передайте ученику/учителю. Пароль больше не покажется.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 text-sm text-gray-600 underline"
      >
        Закрыть
      </button>
    </div>
  );
}