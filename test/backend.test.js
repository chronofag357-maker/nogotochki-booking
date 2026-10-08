import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDb} from '../server/db.js';
import {seed} from '../server/seed.js';
import {makeServer} from '../server/http.js';
import {isFuture,studioNow} from '../server/booking.js';
import {hashPassword} from '../server/auth.js';
test('past time on current day and Moscow midnight boundary',()=>{
 const now={day:'2026-10-08',minute:1200};
 assert.equal(isFuture('2026-10-08',1199,now),false);
 assert.equal(isFuture('2026-10-08',1200,now),false);
 assert.equal(isFuture('2026-10-08',1201,now),true);
 assert.equal(isFuture('2026-10-09',0,now),true);
 assert.deepEqual(studioNow(new Date('2026-10-08T21:10:00Z')),{day:'2026-10-09',minute:10});
});
test('HTTP registration, authentication, slots, race, IDOR, roles and SQLite constraints',async()=>{
 const db=openDb(':memory:');seed(db);seed(db);
 assert.equal(db.prepare('SELECT count(*) n FROM services').get().n,6);
 const server=makeServer(db);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',data,token)=>{
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Cookie:token.cookie,'X-CSRF-Token':token.csrf}:{})},body:data?JSON.stringify(data):undefined});
  const result=r.headers.get('content-type')?.includes('application/json')?await r.json():{html:await r.text()};
  assert.equal(result.token,undefined,'Session token must never be returned in JSON');
  const setCookie=r.headers.get('set-cookie');
  if(setCookie){assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);}
  // Test-only cookie jar; browser JavaScript never reads the session cookie.
  return {status:r.status,data:{...result,...(setCookie?{token:{cookie:setCookie.split(';')[0],csrf:result.csrf}}:{})}};
 };
 try{
 const creds={email:'client-a@example.test',name:'Клиент А',password:'Only-for-local-tests-2026'};
 const a=await call('/api/register','POST',creds);assert.equal(a.status,201);
 const b=await call('/api/register','POST',{...creds,email:'client-b@example.test'});assert.equal(b.status,201);
 assert.equal((await call('/api/bookings','POST',{}, {...a.data.token,csrf:'invalid'})).status,403);
 assert.equal((await call('/api/me','GET',null,a.data.token)).data.user.id,a.data.user.id);
 assert.equal((await call('/api/login','POST',creds)).status,200);
 const bad=await call('/api/login','POST',{...creds,password:'incorrect-password'});assert.equal(bad.status,401);
 assert.equal((await call('/api/register','POST',{...creds,email:'evil@example.test',role:'admin'})).status,400);
 assert.equal((await call('/admin','GET',null,a.data.token)).status,403);
 assert.equal((await call('/api/bookings')).status,401);
 const query='/api/slots?master_id=1&service_id=1&day=2030-10-08';
 const before=await call(query);assert.equal(before.status,200);assert.ok(before.data.slots.includes(600));
 const data={master_id:1,service_id:1,day:'2030-10-08',start_min:600};
 const race=await Promise.all([call('/api/bookings','POST',data,a.data.token),call('/api/bookings','POST',data,b.data.token)]);
 assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 const winner=race.find(r=>r.status===201),loserToken=race[0].status===201?b.data.token:a.data.token;
 assert.equal(db.prepare("SELECT count(*) n FROM bookings WHERE status='active'").get().n,1);
 const idor=await call('/api/bookings/'+winner.data.id,'GET',null,loserToken);assert.equal(idor.status,404);
 const after=await call(query);assert.ok(!after.data.slots.includes(600));assert.ok(!after.data.slots.includes(675));assert.ok(after.data.slots.includes(690));
 // Direct SQL bypass proves protection is enforced by SQLite, independently of API validation.
 assert.throws(()=>db.prepare('INSERT INTO bookings(user_id,master_id,service_id,day,start_min,end_min,service_name,master_name,price) VALUES(?,?,?,?,?,?,?,?,?)').run(a.data.user.id,1,1,'2030-10-08',615,705,'Test','Test',1),/booking_overlap/);
 assert.throws(()=>db.prepare('UPDATE bookings SET user_id=99999 WHERE id=?').run(winner.data.id),/FOREIGN KEY/);
 assert.equal((await call('/api/slots?master_id=1&service_id=1&day=2030-02-30')).status,400);
 assert.equal((await call('/api/slots?master_id=1&service_id=6&day=2030-10-08')).status,400);
 const thursday=await call('/api/slots?master_id=1&service_id=1&day=2030-10-10');assert.ok(!thursday.data.slots.includes(750));
 const saturday=await call('/api/slots?master_id=3&service_id=1&day=2030-10-12');assert.deepEqual(saturday.data.slots,[]);
 // Admin and client mutations use the same transaction and authorization rules.
 const ownerToken=race[0].status===201?a.data.token:b.data.token;
 db.prepare("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,'admin')").run('admin@example.test','Администратор',hashPassword(creds.password));
 const admin=await call('/api/login','POST',{email:'admin@example.test',password:creds.password});
 assert.equal((await call('/api/admin/bookings','GET',null,loserToken)).status,403);
 assert.equal((await call('/api/bookings/'+winner.data.id,'PATCH',{action:'cancel',reason:'Чужая запись'},loserToken)).status,404);
 const moved=await call('/api/bookings/'+winner.data.id,'PATCH',{action:'reschedule',day:'2030-10-09',start_min:600},ownerToken);
 assert.equal(moved.status,200);assert.equal(moved.data.id,winner.data.id);
 assert.equal(db.prepare('SELECT count(*) n FROM notifications').get().n,0,'Own actions do not notify');
 assert.ok((await call(query)).data.slots.includes(600),'Old interval released');
 assert.equal((await call('/api/bookings/'+winner.data.id,'PATCH',{action:'cancel',reason:''},admin.data.token)).status,400);
 const cancel=await call('/api/bookings/'+winner.data.id,'PATCH',{action:'cancel',reason:'Мастер заболел'},admin.data.token);
 assert.equal(cancel.status,200);assert.equal(cancel.data.status,'cancelled');assert.equal(cancel.data.cancel_reason,'Мастер заболел');
 assert.equal(db.prepare('SELECT count(*) n FROM bookings').get().n,1,'Cancellation retains history');
 const notification=db.prepare('SELECT * FROM notifications').get();assert.match(notification.message,/Мастер заболел/);
 assert.equal((await call('/api/notifications/'+notification.id+'/read','POST',{},loserToken)).status,404);
 assert.equal((await call('/api/notifications/'+notification.id+'/read','POST',{},ownerToken)).status,200);
 assert.ok(db.prepare('SELECT read_at FROM notifications').get().read_at);
 assert.equal((await call('/api/admin/services/1','PATCH',{name:'Маникюр — обновлено',price:2500,duration:90,active:0},admin.data.token)).status,200);
 assert.equal(db.prepare('SELECT price FROM bookings WHERE id=?').get(winner.data.id).price,1800,'Historical price retained');
 assert.equal((await call(query)).status,400,'Inactive service cannot be booked');
 const serviceNew=await call('/api/admin/services','POST',{name:'Тестовая услуга',duration:60,price:1000},admin.data.token);assert.equal(serviceNew.status,201);
 const masterNew=await call('/api/admin/masters','POST',{name:'Тестовый мастер',active:1,services:[serviceNew.data.id]},admin.data.token);assert.equal(masterNew.status,201);
 assert.equal((await call('/api/admin/schedules','POST',{master_id:masterNew.data.id,weekday:2,start_min:600,end_min:1080},admin.data.token)).status,201);
 const block={master_id:masterNew.data.id,day:'2030-10-08',start_min:600,end_min:720,reason:'Учебная блокировка'};
 assert.equal((await call('/api/admin/blocks','POST',block,admin.data.token)).status,201);
 const newQuery=`/api/slots?master_id=${masterNew.data.id}&service_id=${serviceNew.data.id}&day=2030-10-08`;
 assert.ok(!(await call(newQuery)).data.slots.includes(600));assert.ok((await call(newQuery)).data.slots.includes(720));
 assert.equal((await call('/api/admin/masters/'+masterNew.data.id,'PATCH',{name:'Тестовый мастер',active:0,services:[serviceNew.data.id]},admin.data.token)).status,200);
 assert.equal((await call(newQuery)).status,400);
 assert.equal((await call('/api/logout','POST',{},a.data.token)).status,200);
 assert.equal((await call('/api/me','GET',null,a.data.token)).status,401);
 console.log(JSON.stringify({registration:a.status,wrongPassword:bad,race:race.map(r=>({status:r.status,error:r.data.error})),activeRows:1,idOR:idor,slotsAfter:after.data.slots}));
 }finally{await new Promise(r=>server.close(r));db.close();}
});
