import {api} from './api.js';
import {renderAdminTools} from './admin-ui.js';
const $=id=>document.getElementById(id);
let user=null,slotsVersion=0,editing=null,masterVersion=0;
const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const message=text=>{$('message').textContent=text;};
function options(select,items,prompt){select.replaceChildren(new Option(prompt,''),...items.map(([value,label])=>new Option(label,value)));}
async function cabinet(){
 $('auth').hidden=!!user;$('account').hidden=!user;
 $('admin').hidden=user?.role!=='admin';
 if(!user){$('bookings').replaceChildren();$('notifications').replaceChildren();$('edit-booking').hidden=true;return;}
 $('welcome').textContent='Личный кабинет · '+user.name;
 const rows=await api('/api/bookings');$('bookings').replaceChildren();
 if(!rows.length)$('bookings').textContent='У вас пока нет записей.';
 for(const b of rows)$('bookings').append(bookingCard(b));
 const notices=await api('/api/notifications');$('notifications').replaceChildren();
 $('notification-title').textContent=`Уведомления · ${notices.filter(n=>!n.read_at).length} непрочитанных`;
 if(!notices.length)$('notifications').textContent='Новых уведомлений пока нет.';
 for(const n of notices){const item=document.createElement('div');item.className='item';item.textContent=n.message;if(!n.read_at){const b=document.createElement('button');b.textContent='Прочитано';b.onclick=()=>run(async()=>{await api(`/api/notifications/${n.id}/read`,'POST',{});await cabinet();});item.append(b);}$('notifications').append(item);}
 if(user.role==='admin')await admin();
}
async function run(action){try{await action();}catch(e){message(e.message);}}
function bookingCard(b){const div=document.createElement('div');div.className='item';div.textContent=`№${b.id} · ${b.client_name?b.client_name+' · ':''}${b.service_name} · ${b.master_name} · ${b.day} ${time(b.start_min)}–${time(b.end_min)} · ${b.price} ₽ · ${b.status==='active'?'Подтверждена':'Отменена'}${b.cancel_reason?' · Причина: '+b.cancel_reason:''}`;
 if(b.status==='active'){const button=document.createElement('button');button.type='button';button.textContent=`Изменить запись №${b.id}`;button.onclick=()=>{editing=b;$('edit-booking').hidden=false;$('edit-title').textContent=`Изменить запись №${b.id}`;$('change-day').value=b.day;$('change-time').value=time(b.start_min);$('change-reason').value='';$('edit-booking').scrollIntoView({behavior:'smooth'});};div.append(button);}return div;}
async function admin(){const [rows,services]=await Promise.all([api('/api/admin/bookings'),api('/api/admin/services')]);$('admin-bookings').replaceChildren(...rows.map(bookingCard));$('admin-services').replaceChildren();await renderAdminTools($('admin-tools'),services,message);
 for(const s of services){const form=document.createElement('form');form.className='item';const heading=document.createElement('h4');heading.textContent=`Услуга №${s.id}`;form.append(heading);const fields={};for(const [key,label,type]of[['name','Название','text'],['price','Цена, ₽','number'],['duration','Длительность, мин','number']]){const l=document.createElement('label'),input=document.createElement('input');input.id=`service-${s.id}-${key}`;input.type=type;input.value=s[key];input.required=true;l.htmlFor=input.id;l.textContent=label;form.append(l,input);fields[key]=input;}const active=document.createElement('select');active.setAttribute('aria-label',`Активность услуги ${s.id}`);options(active,[[1,'Доступна для записи'],[0,'Скрыта, история сохранена']],'Выберите состояние');active.value=String(s.active);const save=document.createElement('button');save.textContent='Сохранить услугу';form.append(active,save);form.onsubmit=e=>{e.preventDefault();run(async()=>{save.disabled=true;try{await api(`/api/admin/services/${s.id}`,'PATCH',{name:fields.name.value,price:Number(fields.price.value),duration:Number(fields.duration.value),active:Number(active.value)});await init();await admin();message('Услуга сохранена. История записей не изменена.');}finally{save.disabled=false;}});};$('admin-services').append(form);}}
 $('refresh-account').onclick=()=>run(cabinet);$('refresh-admin').onclick=()=>run(admin);
 $('close-change').onclick=()=>{$('edit-booking').hidden=true;editing=null;};
 $('change-form').onsubmit=e=>{e.preventDefault();const b=editing;if(!b)return;const submit=e.submitter;run(async()=>{submit.disabled=true;try{const [h,m]=$('change-time').value.split(':').map(Number);await api(`/api/bookings/${b.id}`,'PATCH',{action:$('change-action').value,reason:$('change-reason').value,day:$('change-day').value,start_min:h*60+m});$('edit-booking').hidden=true;editing=null;clearSlots();await cabinet();message(`Изменения записи №${b.id} сохранены.`);}finally{submit.disabled=false;}});};
$('show-password').onclick=()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('show-password').setAttribute('aria-pressed',String(show));$('show-password').textContent=show?'Скрыть пароль':'Показать пароль';};
$('auth-form').onsubmit=async e=>{e.preventDefault();const mode=e.submitter.value;const buttons=[...e.currentTarget.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{const data={email:$('email').value,password:$('password').value};if(mode==='register')data.name=$('name').value;const r=await api('/api/'+mode,'POST',data);user=r.user;$('password').value='';await cabinet();message(mode==='register'?'Аккаунт создан.':'Вход выполнен.');}catch(err){message(err.message);}finally{buttons.forEach(b=>b.disabled=false);}};
$('logout').onclick=async()=>{try{await api('/api/logout','POST',{});user=null;await cabinet();message('Вы вышли.');}catch(e){message(e.message);}};
function clearSlots(){slotsVersion++;options($('time'),[],'Обновите свободное время');}
for(const name of ['service','master','day'])$(name).onchange=clearSlots;
 $('service').onchange=()=>run(async()=>{clearSlots();const version=++masterVersion;options($('master'),[],'Загрузка мастеров…');if(!$('service').value){options($('master'),[],'Сначала выберите услугу');return;}const rows=await api('/api/masters?service_id='+encodeURIComponent($('service').value));if(version===masterVersion)options($('master'),rows.map(m=>[m.id,m.name]),'Выберите мастера');});
$('load-slots').onclick=async()=>{const version=++slotsVersion;options($('time'),[],'Загрузка…');try{const q=new URLSearchParams({service_id:$('service').value,master_id:$('master').value,day:$('day').value});const r=await api('/api/slots?'+q);if(version!==slotsVersion)return;options($('time'),r.slots.map(n=>[n,time(n)]),r.slots.length?'Выберите время':'Свободного времени нет');message(r.slots.length?'Свободное время обновлено.':'Нет свободных слотов. Выберите другую дату.');}catch(e){if(version===slotsVersion){options($('time'),[],'Выберите корректные параметры');message(e.message);}}};
$('booking-form').onsubmit=async e=>{e.preventDefault();if(!user){message('Сначала войдите или создайте аккаунт.');$('email').focus();return;}const button=e.submitter;button.disabled=true;
 try{const b=await api('/api/bookings','POST',{service_id:Number($('service').value),master_id:Number($('master').value),day:$('day').value,start_min:Number($('time').value)});clearSlots();await cabinet();message(`Вы записаны! №${b.id}\n${b.service_name}, ${b.master_name}\n${b.day}, ${time(b.start_min)}–${time(b.end_min)} · ${b.price} ₽`);}catch(e){clearSlots();message(e.message);}finally{button.disabled=false;}};
async function init(){try{const services=await api('/api/services');options($('service'),services.map(s=>[s.id,`${s.name} · ${s.duration} мин · ${s.price} ₽`]),'Выберите услугу');options($('master'),[],'Сначала выберите услугу');$('services').replaceChildren();for(const s of services){const div=document.createElement('div');div.className='item';div.textContent=`${s.name} · ${s.duration} мин · ${s.price} ₽`;$('services').append(div);}}catch(e){message('Не удалось загрузить данные: '+e.message);}}
init();
api('/api/features').then(f=>{$('yandex-login').hidden=!f.yandex;}).catch(()=>{});
const oauthStatus=new URLSearchParams(location.search).get('oauth');
if(oauthStatus)message(({success:'Вход через Яндекс выполнен.',cancelled:'Вход через Яндекс не завершён. Можно попробовать ещё раз или войти по паролю.',expired:'Время ожидания входа истекло. Повторите вход.',failed:'Яндекс не завершил вход. Попробуйте ещё раз или войдите по паролю.','link-required':'Почта уже зарегистрирована. Сначала войдите по паролю, затем нажмите «Войти с Яндекс ID» для безопасного связывания.'})[oauthStatus]||'');
api('/api/me').then(async result=>{user=result.user;await cabinet();}).catch(e=>{if(e.status!==401)message(e.message);});
