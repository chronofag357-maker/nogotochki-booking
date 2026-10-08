import {ApiError,id,validDay} from './booking.js';
const name=s=>typeof s==='string'&&s.trim().length>=2&&s.length<=120;
const interval=b=>Number.isInteger(b.start_min)&&Number.isInteger(b.end_min)&&b.start_min>=0&&b.end_min<=1440&&b.start_min<b.end_min;
export function adminRoute(db,path,method,b){
 if(path==='/api/admin/masters'&&method==='GET')return db.prepare('SELECT * FROM masters').all().map(m=>({...m,services:db.prepare('SELECT service_id FROM master_services WHERE master_id=?').all(m.id).map(s=>s.service_id)}));
 if(path==='/api/admin/schedules'&&method==='GET')return {weekly:db.prepare('SELECT * FROM schedules').all(),blocks:db.prepare('SELECT * FROM date_blocks ORDER BY day,start_min').all()};
 if(path==='/api/admin/services'&&method==='POST'){
  if(!name(b.name)||!Number.isInteger(b.price)||b.price<0||b.price>1000000||!Number.isInteger(b.duration)||b.duration<15||b.duration>600)throw new ApiError(400,'Проверьте название, цену и длительность');
  try{return {id:Number(db.prepare('INSERT INTO services(name,price,duration) VALUES(?,?,?)').run(b.name.trim(),b.price,b.duration).lastInsertRowid)};}catch(e){if(e.message.includes('UNIQUE'))throw new ApiError(409,'Название уже существует');throw e;}
 }
 const masterMatch=path.match(/^\/api\/admin\/masters\/(\d+)$/);
 if((path==='/api/admin/masters'&&method==='POST')||(masterMatch&&method==='PATCH')){
  if(!name(b.name)||![0,1].includes(b.active)||!Array.isArray(b.services)||b.services.length<1||b.services.length>100||new Set(b.services).size!==b.services.length)throw new ApiError(400,'Укажите имя, состояние и услуги мастера');
  for(const s of b.services)if(!db.prepare('SELECT id FROM services WHERE id=?').get(id(s)))throw new ApiError(400,'Услуга не найдена');
  db.exec('BEGIN IMMEDIATE');
  try{let masterId;if(masterMatch){masterId=id(masterMatch[1]);if(!db.prepare('UPDATE masters SET name=?,active=? WHERE id=?').run(b.name.trim(),b.active,masterId).changes)throw new ApiError(404,'Мастер не найден');}else masterId=Number(db.prepare('INSERT INTO masters(name,active) VALUES(?,?)').run(b.name.trim(),b.active).lastInsertRowid);
   db.prepare('DELETE FROM master_services WHERE master_id=?').run(masterId);for(const s of b.services)db.prepare('INSERT INTO master_services VALUES(?,?)').run(masterId,s);db.exec('COMMIT');return {id:masterId};
  }catch(e){db.exec('ROLLBACK');if(e.message.includes('UNIQUE'))throw new ApiError(409,'Имя мастера уже существует');throw e;}
 }
 if(path==='/api/admin/schedules'&&method==='POST'){
  const masterId=id(b.master_id);
  if(!db.prepare('SELECT id FROM masters WHERE id=?').get(masterId))throw new ApiError(404,'Мастер не найден');
  if(!Number.isInteger(b.weekday)||b.weekday<0||b.weekday>6||!interval(b))throw new ApiError(400,'Некорректная смена');
  db.prepare('INSERT INTO schedules(master_id,weekday,start_min,end_min) VALUES(?,?,?,?) ON CONFLICT(master_id,weekday) DO UPDATE SET start_min=excluded.start_min,end_min=excluded.end_min').run(masterId,b.weekday,b.start_min,b.end_min);return {ok:true};
 }
 if(path==='/api/admin/blocks'&&method==='POST'){
  validDay(b.day);const masterId=id(b.master_id);
  if(!db.prepare('SELECT id FROM masters WHERE id=?').get(masterId))throw new ApiError(404,'Мастер не найден');
  if(!interval(b)||!name(b.reason))throw new ApiError(400,'Укажите интервал и причину');
  if(db.prepare("SELECT id FROM bookings WHERE master_id=? AND day=? AND status='active' AND start_min<? AND end_min>?").get(masterId,b.day,b.end_min,b.start_min))throw new ApiError(409,'В интервале есть запись. Сначала перенесите или отмените её с уведомлением клиента.');
  return {id:Number(db.prepare('INSERT INTO date_blocks(master_id,day,start_min,end_min,reason) VALUES(?,?,?,?,?)').run(masterId,b.day,b.start_min,b.end_min,b.reason.trim()).lastInsertRowid)};
 }
 return undefined;
}
