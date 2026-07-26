import Image from "next/image";
import Link from "next/link";
import { Manrope, Playfair_Display } from "next/font/google";
import "./marketing.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const CONTACT_PHONE =
  process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "+992 90 100 04 44";
const CONTACT_PHONE_TEL =
  process.env.NEXT_PUBLIC_CONTACT_PHONE_TEL?.trim() ||
  CONTACT_PHONE.replace(/[^\d+]/g, "");
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@langcenter.tj";
const CONTACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTACT_ADDRESS?.trim() || "г. Душанбе";
const CONTACT_WHATSAPP =
  process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.trim() ||
  CONTACT_PHONE_TEL.replace(/^\+/, "");
const TG_STUDENT = process.env.NEXT_PUBLIC_TG_STUDENT_BOT?.replace(/^@/, "");
const TG_TEACHER = process.env.NEXT_PUBLIC_TG_TEACHER_BOT?.replace(/^@/, "");
const TG_ADMIN = process.env.NEXT_PUBLIC_TG_ADMIN_BOT?.replace(/^@/, "");

const courses = [
  { icon: "A", title: "English", desc: "Общий, разговорный, IELTS" },
  { icon: "文", title: "中文", desc: "Китайский для начинающих" },
  { icon: "R", title: "Русский", desc: "Для учёбы и общения" },
  { icon: "TR", title: "Türkçe", desc: "Для путешествий и работы" },
];

const schedule = [
  {
    course: "English · Elementary",
    level: "A1",
    time: "09:00 — 10:30",
    days: "Пн · Ср · Пт",
    spots: "Осталось 3 места",
  },
  {
    course: "English · Pre-Intermediate",
    level: "A2",
    time: "18:30 — 20:00",
    days: "Вт · Чт · Сб",
    spots: "Осталось 2 места",
  },
  {
    course: "Китайский с нуля",
    level: "HSK 1",
    time: "17:00 — 18:30",
    days: "Пн · Ср · Пт",
    spots: "Идёт набор",
  },
];

const portalCards = [
  {
    href: "/register",
    icon: "✍️",
    title: "Записаться на курс",
    desc: "Регистрация за минуту: свой логин и пароль, выбор курса и удобного времени.",
  },
  {
    href: "/app",
    icon: "📱",
    title: "Приложение",
    desc: "Скачать APK или открыть в браузере — кабинет ученика и учителя на телефоне.",
  },
  {
    href: "/student/login",
    icon: "🎓",
    title: "Кабинет ученика",
    desc: "Войдите логином и паролем, которые сами задали при записи.",
  },
];

export default function HomePage() {
  return (
    <div className={`mk-page ${manrope.variable} ${playfair.variable} ${manrope.className}`}>
      <header className="mk-header">
        <div className="mk-wrap mk-nav">
          <a className="mk-brand" href="#top">
            <span className="mk-brand-mark">LC</span>
            LANG CENTER
          </a>
          <nav className="mk-links" aria-label="Основная навигация">
            <a href="#courses">Курсы</a>
            <a href="#about">О центре</a>
            <a href="#schedule">Расписание</a>
            <a href="#portal">Кабинеты</a>
            <a href="#contact">Контакты</a>
          </nav>
          <div className="mk-nav-actions">
            <a className="mk-nav-phone" href={`tel:${CONTACT_PHONE_TEL}`}>
              {CONTACT_PHONE}
            </a>
            <Link className="mk-nav-login" href="/register">
              Записаться
            </Link>
            <Link className="mk-nav-login" href="/app">
              Войти
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="mk-hero">
          <Image
            className="mk-hero-img"
            src="/marketing/hero-classroom.png"
            alt="Занятие в языковом центре"
            fill
            priority
            sizes="100vw"
          />
          <div className="mk-wrap mk-hero-copy">
            <div className="mk-tag">Душанбе · с 2016 года</div>
            <h1>
              Языки открывают
              <br />
              новые горизонты.
            </h1>
            <p>
              Уверенно говорите, учитесь и стройте карьеру — в современном
              языковом центре с онлайн-кабинетами для учеников и учителей.
            </p>
            <div className="mk-hero-actions">
              <Link className="mk-btn" href="/register">
                Записаться на курс →
              </Link>
              <Link className="mk-btn mk-btn-ghost-dark" href="/app">
                Войти / скачать приложение
              </Link>
            </div>
          </div>
        </section>

        <div className="mk-wrap mk-stats">
          <div className="mk-stat">
            <strong>2 500+</strong>
            <span>выпускников центра</span>
          </div>
          <div className="mk-stat">
            <strong>4 языка</strong>
            <span>для учёбы, работы и жизни</span>
          </div>
          <div className="mk-stat">
            <strong>92%</strong>
            <span>достигают своей цели</span>
          </div>
        </div>

        <section className="mk-section mk-section-soft" id="courses">
          <div className="mk-wrap">
            <div className="mk-top">
              <div>
                <div className="mk-label">Направления</div>
                <h2>
                  Выберите язык
                  <br />
                  своего будущего
                </h2>
              </div>
              <p>
                Живые занятия в небольших группах, опытные преподаватели и
                понятный маршрут к результату.
              </p>
            </div>
            <div className="mk-grid">
              {courses.map((course) => (
                <article key={course.title} className="mk-course">
                  <span className="mk-course-icon">{course.icon}</span>
                  <h3>{course.title}</h3>
                  <p>{course.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-section" id="about">
          <div className="mk-wrap mk-method">
            <div>
              <div className="mk-label">Наш подход</div>
              <h2>
                Не зубрить.
                <br />
                Начать говорить.
              </h2>
              <p>
                Мы соединяем разговорную практику с понятной системой. На каждом
                уроке вы слушаете, обсуждаете и используете язык в реальных
                ситуациях. Прогресс виден в личном кабинете — оценки,
                посещаемость и обратная связь от преподавателя.
              </p>
              <ul className="mk-ticks">
                <li>
                  <span>✓</span>Группы до 10 человек
                </li>
                <li>
                  <span>✓</span>Бесплатное определение уровня
                </li>
                <li>
                  <span>✓</span>Гибкое расписание
                </li>
                <li>
                  <span>✓</span>Онлайн-кабинет ученика и учителя
                </li>
              </ul>
            </div>
            <aside className="mk-quote">
              <div className="mk-tag">Слово преподавателя</div>
              <h3>
                «Ваш голос —
                <br />
                главный учебник.»
              </h3>
              <p>
                Язык живёт только тогда, когда вы им пользуетесь. Поэтому у нас
                говорят с первого занятия — а прогресс фиксируется в системе
                Lang Center.
              </p>
              <b>Мадина Рахимова</b>
              <br />
              <small>академический директор</small>
            </aside>
          </div>
        </section>

        <section className="mk-section mk-section-white" id="schedule">
          <div className="mk-wrap">
            <div className="mk-top">
              <div>
                <div className="mk-label">Ближайшие группы</div>
                <h2>Начните уже в этом месяце</h2>
              </div>
              <Link className="mk-btn" href="/register">
                Подобрать курс →
              </Link>
            </div>
            <div className="mk-rows">
              <div className="mk-row mk-row-head">
                <div>Курс</div>
                <div>Время</div>
                <div>Дни</div>
                <div>Набор</div>
              </div>
              {schedule.map((row) => (
                <div className="mk-row" key={row.course}>
                  <div>
                    <b>{row.course}</b>
                    <br />
                    <span className="mk-pill">{row.level}</span>
                  </div>
                  <div>{row.time}</div>
                  <div>{row.days}</div>
                  <div className="mk-spots">{row.spots}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-section mk-section-soft" id="portal">
          <div className="mk-wrap">
            <div className="mk-top">
              <div>
                <div className="mk-label">Платформа Lang Center</div>
                <h2>
                  Всё обучение —
                  <br />в одном месте
                </h2>
              </div>
              <p>
                Запишитесь онлайн, зайдите в кабинет или скачайте приложение.
                Учителя ставят оценки и посещаемость — всё в одном месте.
              </p>
            </div>
            <div className="mk-portal-grid">
              {portalCards.map((card) => (
                <Link key={card.href} href={card.href} className="mk-portal-card">
                  <span className="mk-portal-icon">{card.icon}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                  <span className="mk-portal-go">Перейти →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-cta" id="contact">
          <div className="mk-wrap mk-cta-inner">
            <div>
              <h2>Первый шаг — самый простой.</h2>
              <p>
                Зарегистрируйтесь, выберите курс — или позвоните нам. Приложение
                можно скачать в любой момент.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link className="mk-btn mk-btn-light" href="/register">
                Записаться онлайн →
              </Link>
              <a className="mk-btn mk-btn-light" href={`tel:${CONTACT_PHONE_TEL}`}>
                Позвонить
              </a>
              <a
                className="mk-btn mk-btn-light"
                href={`https://wa.me/${CONTACT_WHATSAPP}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              {TG_STUDENT ? (
                <a
                  className="mk-btn mk-btn-light"
                  href={`https://t.me/${TG_STUDENT}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Telegram
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="mk-footer">
        <div className="mk-wrap mk-foot">
          <div>
            <a className="mk-brand" href="#top">
              <span className="mk-brand-mark">LC</span>
              LANG CENTER
            </a>
            <br />
            <small>Языковой центр, где знания становятся свободой.</small>
          </div>
          <div className="mk-foot-right">
            {CONTACT_ADDRESS}
            <br />
            <a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE}</a>
            {" · "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <br />
            <a
              href={`https://wa.me/${CONTACT_WHATSAPP}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
            {TG_STUDENT ? (
              <>
                {" · "}
                <a
                  href={`https://t.me/${TG_STUDENT}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ученикам
                </a>
              </>
            ) : null}
            {TG_TEACHER ? (
              <>
                {" · "}
                <a
                  href={`https://t.me/${TG_TEACHER}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Учителям
                </a>
              </>
            ) : null}
            <br />
            <Link href="/register">Запись</Link>
            {" · "}
            <Link href="/app">Кабинет</Link>
            {" · "}
            <Link href="/student/login">Вход ученика</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
