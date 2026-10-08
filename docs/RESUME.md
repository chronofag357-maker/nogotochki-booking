# Продолжение модуля «Ноготочки» — 08.10.2026

Не трогать turbo-fishstick и Telegram-бота. Отдельный репозиторий:
https://github.com/chronofag357-maker/nogotochki-booking

Skypro: 257109 frontend и 257110 admin отправлены, статус «Проверяем домашку».
Контрольные вопросы frontend/admin/deploy отвечены; все учебные блоки 257109,
257110,257111,257112 зелёные. Опросы личного мнения не заполнялись за пользователя.
257111 deployment отчёт отправлен 08.10.26 22:32, «Задание на проверке».
257112 итоговый проект отправлен 08.10.26 22:45; после reload «Задание на проверке».

Дневник по шаблону: https://docs.google.com/spreadsheets/d/1RTaNSFdROfapEML8Ec1ck92T9L-W397RKfp--rBmHac/edit
Видео 4:31: https://drive.google.com/file/d/17UisXLeMiz81jLzrUdrbC2uF-2JD-ROS/view
Отчёт: https://drive.google.com/file/d/10oozwSeS67WhtEtTI7Vn1-PJRiuPxad2/view
Дневник и видео reader по ссылке проверены. Видео без аудио, реальные кадры
вкладки с исходными временными отметками. Все 3 npm test снова прошли.
Исправлено мобильное переполнение grid: было 484px при viewport390,
стало scrollWidth375 при viewport390. CSS повторно опубликован, соседние службы active.

Дальше: дождаться проверки наставником; не выдавать «на проверке» за «зачтено».
Ограничения deployment и минимальный вариант дизайна ногтей указаны в сдаче.

Локальный сервис 8792; данные и evidence игнорируются Git. Админ локальный
admin@example.test (учебный пароль не переносить в production).
Production admin: тот же email, случайный пароль в игнорируемом
.env.admin-production; не публиковать. OAuth config .env.oauth-production тоже
игнорируется. В браузере Яндекс уже залогинен; приложение создано после
явного подтверждения условий пользователем. Реальный OAuth дважды проверен.

Production app: см. docs/DEPLOYED.md. Для обновления tar только server/public/
package.json/deploy, без env/data/evidence. deploy/update.sh делает локальную
на сервере копию перед перезапуском. Не переиспользовать install.sh (он first-run).
SSH identity C:/Users/mars.la/.ssh/freebk_beget_ed25519, root@159.194.244.46.
