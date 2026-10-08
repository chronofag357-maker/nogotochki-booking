import {openDb} from './db.js';
const db=openDb();
console.log(JSON.stringify({
 integrity:db.prepare('PRAGMA integrity_check').all(),
 foreignKeys:db.prepare('PRAGMA foreign_key_check').all(),
 oauthUsers:db.prepare('SELECT id,role,length(password_hash) AS password_length,provider,count(*) OVER() AS oauth_users FROM users WHERE provider IS NOT NULL').all(),
 bookings:db.prepare('SELECT id,day,start_min,end_min,status FROM bookings ORDER BY id').all()
},null,2));
db.close();
