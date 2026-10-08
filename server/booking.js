export class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
export function id(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new ApiError(400,'Неверный идентификатор');return n;}
export function validDay(day){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new ApiError(400,'Неверная дата');
 const dt=new Date(day+'T12:00:00Z');
 if(!Number.isFinite(+dt)||dt.toISOString().slice(0,10)!==day)throw new ApiError(400,'Неверная дата');
 return dt.getUTCDay();
}
export function studioNow(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:process.env.STUDIO_TIMEZONE||'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};
}
export function isFuture(day,start,now=studioNow()){return day>now.day||(day===now.day&&start>now.minute);}
export function slotData(db,master,service,day,exclude=0,duration=null){
 const weekday=validDay(day);
 const s=db.prepare('SELECT s.*,m.name master_name FROM services s JOIN master_services ms ON ms.service_id=s.id JOIN masters m ON m.id=ms.master_id WHERE s.id=? AND m.id=? AND s.active=1 AND m.active=1').get(id(service),id(master));
 if(!s)throw new ApiError(400,'Мастер не оказывает эту услугу');
 if(duration!==null)s.duration=duration;
 const schedule=db.prepare('SELECT * FROM schedules WHERE master_id=? AND weekday=?').get(master,weekday);
 const blocked=db.prepare('SELECT start_min,end_min FROM blocks WHERE master_id=? AND weekday=? UNION ALL SELECT start_min,end_min FROM bookings WHERE master_id=? AND day=? AND status=\'active\' AND id<>?').all(master,weekday,master,day,exclude);
 blocked.push(...db.prepare('SELECT start_min,end_min FROM date_blocks WHERE master_id=? AND day=?').all(master,day));
 const slots=[];
 if(schedule) for(let n=schedule.start_min;n+s.duration<=schedule.end_min;n+=15){
  if(isFuture(day,n)&&!blocked.some(b=>n<b.end_min&&n+s.duration>b.start_min))slots.push(n);
 }
 return {service:s,slots};
}
export function changeBooking(db,user,bookingId,data){
 if(!['cancel','reschedule'].includes(data.action))throw new ApiError(400,'Неизвестное действие');
 db.exec('BEGIN IMMEDIATE');
 try {
  const old=db.prepare("SELECT * FROM bookings WHERE id=? AND (user_id=? OR ?='admin')").get(id(bookingId),user.id,user.role);
  if(!old)throw new ApiError(404,'Запись не найдена');
  if(old.status!=='active')throw new ApiError(409,'Запись уже отменена');
  const now=studioNow();
  const minutes=(Date.parse(old.day+'T00:00:00Z')-Date.parse(now.day+'T00:00:00Z'))/60000+old.start_min-now.minute;
  if(user.role!=='admin'&&minutes<1440)throw new ApiError(409,'Отмена и перенос доступны не позднее чем за 24 часа');
  let text;
  if(data.action==='cancel'){
   if(typeof data.reason!=='string'||data.reason.trim().length<3||data.reason.length>300)throw new ApiError(400,'Укажите причину отмены (3–300 символов)');
   db.prepare("UPDATE bookings SET status='cancelled',cancel_reason=? WHERE id=?").run(data.reason.trim(),old.id);
   text=`Запись №${old.id} отменена. Причина: ${data.reason.trim()}`;
  }else{
   const master=id(data.master_id??old.master_id),start=data.start_min;
   if(!Number.isInteger(start))throw new ApiError(400,'Неверное время');
   const available=slotData(db,master,old.service_id,data.day,old.id,old.end_min-old.start_min);
   if(!available.slots.includes(start))throw new ApiError(409,'Время недоступно. Выберите другой слот.');
   db.prepare('UPDATE bookings SET master_id=?,master_name=?,day=?,start_min=?,end_min=? WHERE id=?').run(master,available.service.master_name,data.day,start,start+available.service.duration,old.id);
   text=`Запись №${old.id} перенесена на ${data.day}, ${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}. Мастер: ${available.service.master_name}`;
  }
  db.prepare('INSERT INTO audit(actor_id,booking_id,action,details) VALUES(?,?,?,?)').run(user.id,old.id,data.action,text);
  if(user.id!==old.user_id)db.prepare('INSERT INTO notifications(user_id,booking_id,message) VALUES(?,?,?)').run(old.user_id,old.id,text);
  const result=db.prepare('SELECT * FROM bookings WHERE id=?').get(old.id);
  db.exec('COMMIT');return result;
 }catch(e){db.exec('ROLLBACK');if(e.message.includes('booking_overlap'))throw new ApiError(409,'Время уже занято');throw e;}
}
export function createBooking(db,user,data){
 const master=id(data.master_id),service=id(data.service_id),day=data.day;
 if(!Number.isInteger(data.start_min)||data.start_min<0||data.start_min>=1440)throw new ApiError(400,'Неверное время');
 validDay(day);
 if(!isFuture(day,data.start_min))throw new ApiError(400,'Нельзя записаться в прошлом');
 db.exec('BEGIN IMMEDIATE');
 try{
  const result=slotData(db,master,service,day);
  if(!result.slots.includes(data.start_min))throw new ApiError(409,'Время недоступно. Выберите другой слот.');
  const r=db.prepare('INSERT INTO bookings(user_id,master_id,service_id,day,start_min,end_min,service_name,master_name,price) VALUES(?,?,?,?,?,?,?,?,?)').run(user.id,master,service,day,data.start_min,data.start_min+result.service.duration,result.service.name,result.service.master_name,result.service.price);
  const booking=db.prepare('SELECT * FROM bookings WHERE id=?').get(r.lastInsertRowid);
  db.exec('COMMIT');return booking;
 }catch(e){db.exec('ROLLBACK');if(e.message.includes('booking_overlap'))throw new ApiError(409,'Время уже занято');throw e;}
}
