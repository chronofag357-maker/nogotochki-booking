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
export function slotData(db,master,service,day){
 const weekday=validDay(day);
 const s=db.prepare('SELECT s.*,m.name master_name FROM services s JOIN master_services ms ON ms.service_id=s.id JOIN masters m ON m.id=ms.master_id WHERE s.id=? AND m.id=? AND s.active=1 AND m.active=1').get(id(service),id(master));
 if(!s)throw new ApiError(400,'Мастер не оказывает эту услугу');
 const schedule=db.prepare('SELECT * FROM schedules WHERE master_id=? AND weekday=?').get(master,weekday);
 const blocked=db.prepare('SELECT start_min,end_min FROM blocks WHERE master_id=? AND weekday=? UNION ALL SELECT start_min,end_min FROM bookings WHERE master_id=? AND day=? AND status=\'active\'').all(master,weekday,master,day);
 const slots=[];
 if(schedule) for(let n=schedule.start_min;n+s.duration<=schedule.end_min;n+=15){
  if(isFuture(day,n)&&!blocked.some(b=>n<b.end_min&&n+s.duration>b.start_min))slots.push(n);
 }
 return {service:s,slots};
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
