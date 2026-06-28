import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

const nav = [
  { href: "/admin", label: "Админ" },
  { href: "/teacher/login", label: "Учитель" },
  { href: "/student/login", label: "Ученик" },
  { href: "/app", label: "Приложение" },
];

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="lc-page min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="font-bold text-slate-900">Lang Center</span>
          </Link>
          <nav className="flex flex-wrap justify-end gap-1 sm:gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-lg text-slate-500">{subtitle}</p>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}