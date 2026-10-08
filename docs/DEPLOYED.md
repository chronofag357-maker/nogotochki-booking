# Учебный deployment — 08.10.2026

https://nogotochki.xn----8sbkaa6ampdcbaci6g.xn--p1ai/

Существующий Beget VPS 159.194.244.46, без покупки тарифа. Отдельный systemd
service nogotochki, OS user nogotochki, /opt/nogotochki/app, Node 24.19.0 из
официального архива с SHA256. Сервис слушает только 127.0.0.1:8793; Nginx HTTPS.
MemoryMax 192M, CPUQuota 40%, NoNewPrivileges, ProtectSystem=strict.
SQLite /var/lib/nogotochki/booking.sqlite вне кода. Перед обновлением — остановка
только этого приложения и копия его data/app в /opt/nogotochki/backups.

DNS A добавлена отдельно в аккаунте домена. TLS до 06.01.2027, выпуск Certbot
прошёл; установленное renewal-расписание существует, dry-run не выполнялся.
Бот freebk-bot и p2p-livekit остались active; NRestarts бота 0.

Браузер: зарегистрирован вымышленный deployment-check@example.test, запись №1
на ламинирование у Марины 15.10 12:00–13:00 создана. Повторное обновление
сервиса сохранило запись и сессию. Администратор перенёс тот же ID на 16.10
12:00–13:00. Клиент увидел это время и уведомление. Клиентский /admin — HTML 403.

Yandex OAuth: настоящий первый и повторный вход через PKCE S256 прошли.
Проверка SQLite: id=2, role=client, password_length=0, provider=yandex,
oauth_users=1. integrity_check=ok, foreign_key_check пуст. Токены провайдера
не сохраняются. ClientID/callback в отдельном /etc/nogotochki/oauth.env,
секрет приложения не использован (PKCE); конфигурация не в репозитории.
Одинаковый email не связывается молча: сначала нужен вход в существующий
аккаунт по паролю, затем OAuth. Это защита от предварительного захвата аккаунта.

Границы: deployment выполнен через systemd вместо Coolify ради экономии RAM
и сохранения существующих сервисов. Dockerfile пока НЕ проверен сборкой.
GitHub autodeploy не настроен. Реальные клиенты и платежи не подключались.
Учебные данные плюс собственный аккаунт владельца для OAuth; телефон, портрет,
дата рождения не запрашиваются, пол из bundled scope не сохраняется.
После защиты судьбу отдельного приложения согласовать с владельцем; весь VPS,
домен и чужие сервисы НЕ удалять.

Документация протокола:
https://yandex.ru/dev/id/doc/ru/codes/code-url
https://yandex.ru/dev/id/doc/ru/user-information
