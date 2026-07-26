# Telegram-боты Lang Center

Два бота:

| Бот | Для кого | Назначение |
|-----|----------|------------|
| **Admin** | владелец + администрация | заявки, логины/пароли, списки |
| **Student** | ученики | запись, оценки, посещаемость, оплата |

## 1. Создать ботов в Telegram

1. Открой [@BotFather](https://t.me/BotFather)
2. `/newbot` → имя например `Lang Center Admin` → username `langcenter_admin_bot`
3. Сохрани **token**
4. Ещё раз `/newbot` → `Lang Center Student` → `langcenter_student_bot`
5. Сохрани второй **token**

## 2. SQL в Supabase

`supabase/TELEGRAM.sql` → SQL Editor → Run

## 3. Переменные на Vercel

```
TELEGRAM_ADMIN_BOT_TOKEN=123456:ABC...
TELEGRAM_STUDENT_BOT_TOKEN=789012:XYZ...
TELEGRAM_WEBHOOK_SECRET=любая_длинная_строка
APP_URL=https://langcenter-tillojon.vercel.app
```

Опционально (кнопки на сайте):

```
NEXT_PUBLIC_TG_STUDENT_BOT=langcenter_student_bot
NEXT_PUBLIC_TG_ADMIN_BOT=langcenter_admin_bot
```

Опционально (chat id без /auth):

```
TELEGRAM_ADMIN_CHAT_IDS=123456789,987654321
```

После добавления env — **Redeploy**.

## 4. Включить webhook

После деплоя (подставь свой secret):

```bash
curl -X POST "https://langcenter-tillojon.vercel.app/api/telegram/setup" ^
  -H "x-setup-secret: ТВОЙ_TELEGRAM_WEBHOOK_SECRET"
```

Или secret = `ADMIN_PASSWORD`, если `TELEGRAM_WEBHOOK_SECRET` не задан.

## 5. Привязать админа

1. Открой admin-бота в Telegram
2. `/start`
3. `/auth ВАШ_ADMIN_PASSWORD`
4. Готово — новые заявки с `/register` приходят в этот чат

## 6. Ученик

1. Регистрация на сайте или «Записаться» в student-боте
2. В student-боте: `/login ЛОГИН пароль`
3. Кнопки: Оценки / Посещаемость / Оплата / Учителя

## Проверка

- GET `/api/telegram/admin/webhook` → `configured: true`
- GET `/api/telegram/student/webhook` → `configured: true`
- Регистрация на сайте → сообщение в admin-бот
