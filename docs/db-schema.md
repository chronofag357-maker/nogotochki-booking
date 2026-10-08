# Схема

9 таблиц: 8 предметных + migrations.

- users: id, email UNIQUE NOCASE, name, password_hash, role (client/master/admin).
- sessions: token_hash PK, user_id FK users, expires. В БД SHA-256 токена,
  не сам токен; срок 8 часов. Пароли scrypt с индивидуальной случайной солью.
- services: id, name UNIQUE, duration, price (целые рубли), active.
- masters: id, name UNIQUE, active.
- master_services: master_id FK, service_id FK, составной PK.
- schedules: master_id FK, weekday (0=воскресенье), start_min, end_min, составной PK.
- blocks: id, master_id FK, weekday, start_min, end_min, reason, уникальный интервал.
- bookings: id, user_id FK, master_id FK, service_id FK, day, start_min, end_min,
  service_name, master_name, price — снимок при создании; status active/cancelled.
- migrations: version PK.

Свободные слоты не хранятся: рабочая смена минус блокировки и активные записи,
с учётом длительности услуги, шага 15 минут, текущего времени и специализации.
Пересечение полуоткрытых интервалов: old.start < new.end AND old.end > new.start.
Триггеры INSERT/UPDATE запрещают пересечение, даже если обойти API.
BEGIN IMMEDIATE сериализует проверку/запись. WAL, busy_timeout=5000,
foreign_keys=ON включены на каждом подключении до миграции.
