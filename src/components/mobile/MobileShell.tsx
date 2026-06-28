"use client";

import { Logo } from "@/components/ui/Logo";

type Tab = {
  id: string;
  label: string;
  icon: string;
};

type Props = {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children: React.ReactNode;
};

export function MobileShell({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
}: Props) {
  return (
    <div className="lc-page flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-10 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Logo size="sm" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-slate-900">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32">{children}</main>

      {tabs && tabs.length > 0 && onTabChange && (
        <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-20 px-4 pb-3">
          <div className="mx-auto flex max-w-lg gap-1 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-lg shadow-slate-200/50 backdrop-blur-md">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`lc-btn flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] ${
                    active
                      ? "bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-200"
                      : "font-medium text-slate-500"
                  }`}
                >
                  <span className="text-lg leading-none">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}