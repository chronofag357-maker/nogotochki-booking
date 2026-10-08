import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {openDb} from './db.js';
import {hashPassword,verifyPassword,newSession,userForToken,digest} from './auth.js';
import {ApiError,id,slotData,createBooking,changeBooking} from './booking.js';
import {adminRoute} from './admin.js';
import {yandexAuth} from './yandex.js';
export function makeServer(db){
 const attempts=new Map();
 const oauth=yandexAuth(db);
 return createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url,'http://localhost'),path=url.pathname,method=req.method;
   const assets={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/api.js':['api.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
   assets['/admin-ui.js']=['admin-ui.js','text/javascript; charset=utf-8'];
   if(method==='GET'&&Object.hasOwn(assets,path)){
    const [file,type]=assets[path];res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Cache-Control':'no-store'});return res.end(readFileSync(new URL('../public/'+file,import.meta.url)));
   }
   let body={};
   if(['POST','PATCH','PUT'].includes(method)){
    if(!req.headers['content-type']?.startsWith('application/json'))throw new ApiError(415,'Нужен application/json');
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw new ApiError(413,'Слишком большой запрос');}
    try{body=JSON.parse(raw);}catch{throw new ApiError(400,'Неверный JSON');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError(400,'Ожидается объект');
   }
   const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('nogotochki_session='))?.slice('nogotochki_session='.length);
   const user=userForToken(db,token);
   if(await oauth.handle(req,res,url,user))return;
   if(method==='GET'&&path==='/api/features')return reply(200,{yandex:oauth.enabled});
   // A session-derived CSRF token is not an authentication credential.
   // JSON-only writes plus SameSite and an explicit CSRF header prevent cross-site mutation.
   const csrf=token?digest('csrf:'+token):'';
   if(user&&['POST','PATCH','PUT','DELETE'].includes(method)&&req.headers['x-csrf-token']!==csrf)throw new ApiError(403,'Обновите страницу: проверка безопасности не пройдена');
   const cookie=(value,maxAge)=>`nogotochki_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;
   const requireUser=()=>{if(!user)throw new ApiError(401,'Необходим вход');return user;};
   if(method==='GET'&&path==='/health')return reply(200,{ok:true});
   if(method==='POST'&&['/api/register','/api/login'].includes(path)){
    const key=req.socket.remoteAddress,now=Date.now();
    for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
    const counter=attempts.get(key)||{count:0,until:now+60000};
    if(++counter.count>30)throw new ApiError(429,'Слишком много попыток. Подождите минуту.');attempts.set(key,counter);
    if(typeof body.email!=='string'||body.email.length>200||!/^\S+@\S+\.\S+$/.test(body.email)||typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new ApiError(400,'Укажите email и пароль длиной 12–128 символов');
    const email=body.email.trim().toLowerCase();
    if(path==='/api/register'){
     if(typeof body.name!=='string'||body.name.trim().length<2||body.name.length>80)throw new ApiError(400,'Укажите имя');
     if('role' in body)throw new ApiError(400,'Роль нельзя выбрать при регистрации');
     try{db.prepare('INSERT INTO users(email,name,password_hash) VALUES(?,?,?)').run(email,body.name.trim(),hashPassword(body.password));}
     catch(e){if(e.message.includes('UNIQUE'))throw new ApiError(409,'Аккаунт уже существует');throw e;}
    }
    const found=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(!found||!verifyPassword(body.password,found.password_hash))throw new ApiError(401,'Неверный email или пароль');
    if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
    const session=newSession(db,found.id);
    res.setHeader('Set-Cookie',cookie(session,8*60*60));
    return reply(path==='/api/register'?201:200,{csrf:digest('csrf:'+session),user:{id:found.id,name:found.name,role:found.role}});
   }
   if(method==='POST'&&path==='/api/logout'){requireUser();db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));res.setHeader('Set-Cookie',cookie('',0));return reply(200,{ok:true});}
   if(method==='GET'&&path==='/api/me')return reply(200,{user:requireUser(),csrf});
   if(method==='GET'&&path==='/api/services')return reply(200,db.prepare('SELECT * FROM services WHERE active=1').all());
   if(method==='GET'&&path==='/api/masters')return reply(200,url.searchParams.has('service_id')?db.prepare('SELECT m.* FROM masters m JOIN master_services ms ON ms.master_id=m.id WHERE m.active=1 AND ms.service_id=?').all(id(url.searchParams.get('service_id'))):db.prepare('SELECT * FROM masters WHERE active=1').all());
   if(method==='GET'&&path==='/api/slots')return reply(200,slotData(db,id(url.searchParams.get('master_id')),id(url.searchParams.get('service_id')),url.searchParams.get('day')));
   if(method==='GET'&&path==='/api/bookings'){requireUser();return reply(200,db.prepare('SELECT * FROM bookings WHERE user_id=? ORDER BY day,start_min').all(user.id));}
   if(method==='POST'&&path==='/api/bookings')return reply(201,createBooking(db,requireUser(),body));
   const match=path.match(/^\/api\/bookings\/(\d+)$/);
   if(method==='PATCH'&&match)return reply(200,changeBooking(db,requireUser(),match[1],body));
   if(method==='GET'&&path==='/api/notifications'){requireUser();return reply(200,db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id));}
   const notice=path.match(/^\/api\/notifications\/(\d+)\/read$/);
   if(method==='POST'&&notice){requireUser();const r=db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(id(notice[1]),user.id);if(!r.changes)throw new ApiError(404,'Уведомление не найдено');return reply(200,{ok:true});}
   if(method==='GET'&&match){
    requireUser();const booking=db.prepare('SELECT * FROM bookings WHERE id=? AND (user_id=? OR ?=\'admin\')').get(id(match[1]),user.id,user.role);
    if(!booking)throw new ApiError(404,'Запись не найдена');return reply(200,booking);
   }
   if(path==='/admin'||path.startsWith('/api/admin')){
    requireUser();if(user.role!=='admin')throw new ApiError(403,'Доступ только администратору');
    const adminResult=adminRoute(db,path,method,body);if(adminResult!==undefined)return reply(method==='POST'?201:200,adminResult);
    if(method==='GET'&&path==='/admin'){res.writeHead(302,{Location:'/#admin'});return res.end();}
    if(method==='GET'&&path==='/api/admin/bookings')return reply(200,db.prepare('SELECT b.*,u.name client_name FROM bookings b JOIN users u ON u.id=b.user_id ORDER BY b.day,b.start_min').all());
    if(method==='GET'&&path==='/api/admin/services')return reply(200,db.prepare('SELECT * FROM services').all());
    const service=path.match(/^\/api\/admin\/services\/(\d+)$/);
    if(method==='PATCH'&&service){
     if(typeof body.name!=='string'||body.name.trim().length<2||body.name.length>120||!Number.isInteger(body.price)||body.price<0||body.price>1000000||!Number.isInteger(body.duration)||body.duration<15||body.duration>600||![0,1].includes(body.active))throw new ApiError(400,'Проверьте название, цену, длительность и активность');
     const result=db.prepare('UPDATE services SET name=?,price=?,duration=?,active=? WHERE id=?').run(body.name.trim(),body.price,body.duration,body.active,id(service[1]));
     if(!result.changes)throw new ApiError(404,'Услуга не найдена');return reply(200,{ok:true});
    }
   }
   throw new ApiError(404,'Маршрут не найден');
  }catch(e){
   if(req.url==='/admin'&&[401,403].includes(e.status)){
    res.writeHead(e.status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'"});
    return res.end('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Доступ закрыт — Ноготочки</title><link rel="stylesheet" href="/style.css"><main><h1>Доступ закрыт</h1><p>'+e.status+': '+(e.status===403?'Доступ только администратору':'Необходим вход')+'</p><a href="/">Вернуться в сервис</a></main></html>');
   }
   reply(e.status||500,{error:e.status?e.message:'Внутренняя ошибка сервера'});
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const db=openDb(),server=makeServer(db);
 server.listen(Number(process.env.PORT||8792),process.env.HOST||'127.0.0.1',()=>console.log('Nogotochki API listening on '+(process.env.PORT||8792)));
}
