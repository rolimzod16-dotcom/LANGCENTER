import Link from "next/link";

const sections = [
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
        Каркас проекта
      </h1>
      <p className="mt-4 text-lg text-zinc-600">
        Supabase подключён. Добавляй учеников, дальше — Firebase и приложение.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
          >
            <h2 className="font-semibold text-zinc-900">{section.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{section.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}