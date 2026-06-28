"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/Logo";

type Props = {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
};

export function AdminSubLayout({ title, description, children }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="lc-page min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              ← Админ
            </Link>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {description && (
          <p className="mb-6 leading-relaxed text-slate-600">{description}</p>
        )}
        {children}
      </main>
    </div>
  );
}