import Link from "next/link";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-semibold text-indigo-600">
            Lang Center
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600">
            <Link href="/admin" className="hover:text-zinc-900">
              Админ
            </Link>
            <Link href="/teacher/login" className="hover:text-zinc-900">
              Учитель
            </Link>
            <Link href="/student/login" className="hover:text-zinc-900">
              Ученик
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-2 text-zinc-600">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}