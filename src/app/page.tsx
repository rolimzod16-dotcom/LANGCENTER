import Link from "next/link";
import { ApkDownloadButton } from "@/components/mobile/ApkDownloadButton";

const sections = [
  {
    href: "/app",
    title: "📱 Приложение",
    desc: "Скачать APK или открыть в браузере — для учителей и учеников",
    highlight: true,
  },
  {
    href: "/admin",
    title: "Админ",
    desc: "Шаг 1: учителя → Шаг 2: ученики",
  },
  {
    href: "/teacher/login",
    title: "Учитель",
    desc: "Мои ученики, баллы, посещаемость",
  },
  {
    href: "/student/login",
    title: "Ученик",
    desc: "Учителя, оценки, посещаемость",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <p className="text-sm font-medium text-indigo-600">Lang Center SaaS</p>
      <h1 className="mt-2 text-4xl font-bold text-zinc-900">
        Языковой центр
      </h1>
      <p className="mt-4 text-lg text-zinc-600">
        Управление учителями, учениками, оценками и посещаемостью.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <ApkDownloadButton variant="compact" />
        <span className="text-sm text-zinc-500">
          Скачать приложение для Android
        </span>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className={`rounded-2xl border bg-white p-5 transition hover:shadow-sm ${
              section.highlight
                ? "border-indigo-300 ring-2 ring-indigo-100"
                : "border-zinc-200 hover:border-indigo-300"
            }`}
          >
            <h2 className="font-semibold text-zinc-900">{section.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{section.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}