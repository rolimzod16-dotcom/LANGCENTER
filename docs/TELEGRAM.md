# Telegram-боты Lang Center

Три бота (одна БД, разные роли):

| Бот | Для кого | Назначение |
|-----|----------|------------|
| **Admin** | владелец + администрация | заявки, поиск, назначение, **создать ученика и учителя** |
| **Student** | ученики | пробный урок, регистрация, кабинет |
| **Teacher** | учителя | **посещаемость и оценки** в Telegram (+ веб) |

## 1. Создать ботов в @BotFather

1. Admin → token → `TELEGRAM_ADMIN_BOT_TOKEN`
2. Student → token → `TELEGRAM_STUDENT_BOT_TOKEN`
3. Teacher → token → `TELEGRAM_TEACHER_BOT_TOKEN`

## 2. База

`supabase/schema.sql` → SQL Editor нового проекта → Run
(есть `students.telegram_chat_id` и `teachers.telegram_chat_id`)

## 3. Env на Vercel

```
TELEGRAM_ADMIN_BOT_TOKEN=...
TELEGRAM_STUDENT_BOT_TOKEN=...
TELEGRAM_TEACHER_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
APP_URL=https://langcenter-tillojon.vercel.app
NEXT_PUBLIC_TG_STUDENT_BOT=username_без_@
NEXT_PUBLIC_TG_ADMIN_BOT=...
NEXT_PUBLIC_TG_TEACHER_BOT=...
```

Redeploy → `POST /api/telegram/setup` с `x-setup-secret`.

## 4. Создать ученика в TG

1. Админ: **➕ Ученик** (или `/newstudent`)
2. Фамилия и имя → телефон (или «-»)
3. Бот выдаёт логин и пароль, затем предлагает назначить учителя
4. Ученик входит: `/login ЛОГИН пароль` в student-боте

## 5. Учитель в TG

1. Админ: **➕ Учитель** → ФИО → телефон → **смены через запятую**
2. Потом **➕ Ученик** и закрепить на одну или несколько смен того же учителя
3. Учитель: `/login TCH-… пароль`
4. **✅ Посещаемость** / **📊 Поставить оценку** / **👥 Мои ученики**

Ученик может ходить на 1 смену или на 5–6 — отмечаешь смены при назначении. Новые ученики добавляются в любой момент, не только сразу после учителя.

Веб-кабинет по-прежнему: `/teacher/login`
