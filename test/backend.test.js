import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDb} from '../server/db.js';
import {seed} from '../server/seed.js';
import {makeServer} from '../server/http.js';
import {isFuture,studioNow} from '../server/booking.js';
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
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});
  return {status:r.status,data:await r.json()};
 };
 try{
 const creds={email:'client-a@example.test',name:'Клиент А',password:'Only-for-local-tests-2026'};
 const a=await call('/api/register','POST',creds);assert.equal(a.status,201);
 const b=await call('/api/register','POST',{...creds,email:'client-b@example.test'});assert.equal(b.status,201);
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
 assert.equal((await call('/api/logout','POST',{},a.data.token)).status,200);
 assert.equal((await call('/api/me','GET',null,a.data.token)).status,401);
 console.log(JSON.stringify({registration:a.status,wrongPassword:bad,race:race.map(r=>({status:r.status,error:r.data.error})),activeRows:1,idOR:idor,slotsAfter:after.data.slots}));
 }finally{await new Promise(r=>server.close(r));db.close();}
});
