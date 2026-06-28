import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

type Props = {
  role: "teacher" | "student";
  title: string;
  subtitle: string;
  backHref?: string;
  children: React.ReactNode;
};

const roleColors = {
  teacher: {
    badge: "text-indigo-600",
    accent: "from-indigo-50/80",
  },
  student: {
    badge: "text-emerald-600",
    accent: "from-emerald-50/80",
  },
};

export function LoginLayout({
  role,
  title,
  subtitle,
  backHref = "/app",
  children,
}: Props) {
  const colors = roleColors[role];

  return (
    <div className={`lc-page safe-top safe-bottom bg-gradient-to-b ${colors.accent} to-transparent`}>
      <main className="mx-auto max-w-lg px-4 py-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
        >
          ← Назад
        </Link>

        <div className="mt-8 flex flex-col items-center text-center">
          <Logo size="md" />
          <p className={`mt-4 text-sm font-semibold uppercase tracking-wider ${colors.badge}`}>
            {role === "teacher" ? "Учитель" : "Ученик"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 max-w-xs text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}