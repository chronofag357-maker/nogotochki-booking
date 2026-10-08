CREATE TABLE users (
 id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client','master','admin'))
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 expires INTEGER NOT NULL
);
CREATE TABLE services (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, duration INTEGER NOT NULL CHECK(duration>0),
 price INTEGER NOT NULL CHECK(price>=0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE masters (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE master_services (
 master_id INTEGER REFERENCES masters(id), service_id INTEGER REFERENCES services(id),
 PRIMARY KEY(master_id,service_id)
);
CREATE TABLE schedules (
 master_id INTEGER REFERENCES masters(id), weekday INTEGER CHECK(weekday BETWEEN 0 AND 6),
 start_min INTEGER NOT NULL CHECK(start_min>=0), end_min INTEGER NOT NULL CHECK(end_min<=1440 AND end_min>start_min),
 PRIMARY KEY(master_id,weekday)
);
CREATE TABLE blocks (
 id INTEGER PRIMARY KEY, master_id INTEGER NOT NULL REFERENCES masters(id),
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 start_min INTEGER NOT NULL, end_min INTEGER NOT NULL CHECK(end_min>start_min),
 reason TEXT NOT NULL, UNIQUE(master_id,weekday,start_min,end_min)
);
CREATE TABLE bookings (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 master_id INTEGER NOT NULL REFERENCES masters(id), service_id INTEGER NOT NULL REFERENCES services(id),
 day TEXT NOT NULL CHECK(length(day)=10), start_min INTEGER NOT NULL CHECK(start_min>=0),
 end_min INTEGER NOT NULL CHECK(end_min>start_min AND end_min<=1440),
 service_name TEXT NOT NULL, master_name TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled'))
);
CREATE INDEX bookings_intervals ON bookings(master_id,day,start_min,end_min) WHERE status='active';
CREATE INDEX bookings_owner ON bookings(user_id);
CREATE TRIGGER booking_no_overlap_insert BEFORE INSERT ON bookings
WHEN NEW.status='active' AND EXISTS(SELECT 1 FROM bookings b WHERE b.status='active'
 AND b.master_id=NEW.master_id AND b.day=NEW.day AND b.start_min<NEW.end_min AND b.end_min>NEW.start_min)
BEGIN SELECT RAISE(ABORT,'booking_overlap'); END;
CREATE TRIGGER booking_no_overlap_update BEFORE UPDATE ON bookings
WHEN NEW.status='active' AND EXISTS(SELECT 1 FROM bookings b WHERE b.id!=NEW.id AND b.status='active'
 AND b.master_id=NEW.master_id AND b.day=NEW.day AND b.start_min<NEW.end_min AND b.end_min>NEW.start_min)
BEGIN SELECT RAISE(ABORT,'booking_overlap'); END;
