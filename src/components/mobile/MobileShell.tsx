"use client";

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
    <div className="flex min-h-dvh flex-col bg-zinc-50">
      <header className="safe-top sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Lang Center
          </p>
          <h1 className="text-lg font-bold text-zinc-900">{title}</h1>
          {subtitle && (
            <p className="truncate text-sm text-zinc-500">{subtitle}</p>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">{children}</main>

      {tabs && tabs.length > 0 && onTabChange && (
        <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-lg">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition ${
                    active
                      ? "font-semibold text-indigo-600"
                      : "text-zinc-500"
                  }`}
                >
                  <span className="text-xl leading-none">{tab.icon}</span>
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