# Telegram-боты Lang Center

Три бота (одна БД, разные роли):

| Бот | Для кого | Назначение |
|-----|----------|------------|
| **Admin** | владелец + администрация | заявки, поиск, назначение, **создать учителя** |
| **Student** | ученики | пробный урок, регистрация, кабинет |
| **Teacher** | учителя | **посещаемость и оценки** в Telegram (+ веб) |

## 1. Создать ботов в @BotFather

1. Admin → token → `TELEGRAM_ADMIN_BOT_TOKEN`
2. Student → token → `TELEGRAM_STUDENT_BOT_TOKEN`
3. Teacher → token → `TELEGRAM_TEACHER_BOT_TOKEN`

## 2. SQL

`supabase/TELEGRAM.sql` → Run  
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

## 4. Учитель в TG

1. Админ: **➕ Учитель** в admin-боте (или сайт)
2. Учитель открывает teacher-бота
3. `/login TCH-… пароль`
4. **✅ Посещаемость** / **📊 Поставить оценку** / **👥 Мои ученики**

Веб-кабинет по-прежнему: `/teacher/login`
