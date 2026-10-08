# Ноготочки — учебный сервис записи

Отдельный от Telegram-бота проект. Node.js 24+. Платных зависимостей нет.

```powershell
npm run seed
npm test
npm start
```

API слушает 127.0.0.1:8792. База создаётся в data/nogotochki.sqlite.
Настройки: .env.example; для собственных значений создать локальный .env.
Seed повторяемый, не стирает данные; администратора создаёт только при явно
заданном SEED_ADMIN_PASSWORD (минимум 12 символов), email admin@example.test.
Не использовать этот учебный аккаунт в production. Автосоздания паролей нет.

API: POST /api/register, /api/login, /api/logout; GET /api/me, /api/services,
/api/masters, /api/slots?master_id=1&service_id=1&day=2030-10-08;
GET/POST /api/bookings, GET /api/bookings/:id.
Для авторизации: Authorization: Bearer TOKEN. Не сохранять токен в репозитории.
Регистрация: email, name, password. Запись: master_id, service_id, day,
start_min (минуты от начала дня в часовом поясе студии).

Миграции применяются при открытии базы один раз. Для нового теста используйте
новый DB_PATH или :memory:. Команды автоматического удаления рабочей БД нет.
Тесты работают с изолированной временной базой, не трогают пользовательские данные.

Backend домашка отправлена 08.10.2026 в20:43 МСК, статус «Задание на проверке».
Черновой интерфейс доступен в корне сервера, проверен браузером.
Исходники опубликованы: https://github.com/chronofag357-maker/nogotochki-booking
Это отдельный репозиторий, не Telegram-бот turbo-fishstick. Финальные кабинет,
админка, уведомления и деплой пока не реализованы.
