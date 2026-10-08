import {openDb} from './db.js';
import {hashPassword} from './auth.js';
import {pathToFileURL} from 'node:url';
export function seed(db){
 const services=[['Маникюр с гель-лаком',90,1800],['Маникюр + педикюр',150,3200],['Наращивание ногтей',150,2800],['Дизайн двух ногтей',15,300],['Оформление и окрашивание бровей',40,1200],['Ламинирование бровей',60,1800]];
 db.exec('BEGIN IMMEDIATE');
 try{
 services.forEach((s,i)=>db.prepare('INSERT OR IGNORE INTO services(id,name,duration,price) VALUES(?,?,?,?)').run(i+1,...s));
 ['Анна Ковалева','Марина Орлова','Елена Смирнова'].forEach((n,i)=>db.prepare('INSERT OR IGNORE INTO masters(id,name) VALUES(?,?)').run(i+1,n));
 [[1,[1,2,3,4]],[2,[5,6]],[3,[1,3,5,6]]].forEach(([m,ss])=>ss.forEach(s=>db.prepare('INSERT OR IGNORE INTO master_services VALUES(?,?)').run(m,s)));
 [[1,[2,3,4,5],600,1080],[2,[3,4,5,6],660,1200],[3,[2,4,6],600,1140]].forEach(([m,days,start,end])=>days.forEach(d=>db.prepare('INSERT OR IGNORE INTO schedules VALUES(?,?,?,?)').run(m,d,start,end)));
 [[1,4,780,840,'Обед'],[2,5,900,1020,'Личное время'],[3,6,0,1440,'Выходной']].forEach(b=>db.prepare('INSERT OR IGNORE INTO blocks(master_id,weekday,start_min,end_min,reason) VALUES(?,?,?,?,?)').run(...b));
 db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const db=openDb();seed(db);
 if(process.env.SEED_ADMIN_PASSWORD){
  if(process.env.SEED_ADMIN_PASSWORD.length<12) throw Error('Admin password must be at least 12 characters');
  db.prepare("INSERT OR IGNORE INTO users(email,name,password_hash,role) VALUES(?,?,?,'admin')").run('admin@example.test','Учебный администратор',hashPassword(process.env.SEED_ADMIN_PASSWORD));
 }
 console.log('Seed complete: services='+db.prepare('SELECT count(*) n FROM services').get().n);db.close();
}
