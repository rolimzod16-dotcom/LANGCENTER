import Link from "next/link";
import { ApkDownloadButton } from "@/components/mobile/ApkDownloadButton";
import { Logo } from "@/components/ui/Logo";

const sections = [
  {
    href: "/app",
    title: "Мобильное приложение",
    desc: "Скачать APK или войти в браузере — для учителей и учеников",
    icon: "📱",
    accent: "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white",
    highlight: true,
  },
  {
    href: "/admin",
    title: "Админ-панель",
    desc: "Добавление учителей и учеников, коды и пароли",
    icon: "⚙️",
    accent: "border-violet-200 bg-gradient-to-br from-violet-50 to-white",
  },
  {
    href: "/teacher/login",
    title: "Кабинет учителя",
    desc: "Ученики, посещаемость, выставление оценок",
    icon: "👨‍🏫",
    accent: "border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white",
  },
  {
    href: "/student/login",
    title: "Кабинет ученика",
    desc: "Оценки, посещаемость, информация об учителях",
    icon: "🎓",
    accent: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
  },
];

export default function HomePage() {
  return (
    <div className="lc-page">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Lang Center
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Языковой центр
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-500">
            Удобная платформа для учителей, учеников и администраторов —
            оценки, посещаемость и управление в одном месте.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ApkDownloadButton variant="compact" />
          <Link
            href="/app"
            className="lc-btn lc-btn-ghost px-5 py-2.5 text-sm"
          >
            Открыть приложение
          </Link>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`lc-link-card group p-6 ${section.accent} ${
                section.highlight ? "ring-2 ring-indigo-100" : ""
              }`}
            >
              <span className="text-3xl">{section.icon}</span>
              <h2 className="mt-4 text-lg font-bold text-slate-900">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {section.desc}
              </p>
              <p className="mt-4 text-sm font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
                Перейти →
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}