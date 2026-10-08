const $=id=>document.getElementById(id);
let token='',user=null,slotsVersion=0;
const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const message=text=>{$('message').textContent=text;};
async function api(path,method='GET',data){
 const r=await fetch(path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});
 const result=await r.json();if(!r.ok)throw Error(`${r.status}: ${result.error}`);return result;
}
function options(select,items,prompt){select.replaceChildren(new Option(prompt,''),...items.map(([value,label])=>new Option(label,value)));}
async function cabinet(){
 $('auth').hidden=!!user;$('account').hidden=!user;
 if(!user){$('bookings').replaceChildren();return;}
 $('welcome').textContent='Личный кабинет · '+user.name;
 const rows=await api('/api/bookings');$('bookings').replaceChildren();
 if(!rows.length)$('bookings').textContent='У вас пока нет записей.';
 for(const b of rows){const div=document.createElement('div');div.className='item';div.textContent=`№${b.id} · ${b.service_name} · ${b.master_name} · ${b.day} ${time(b.start_min)}–${time(b.end_min)} · ${b.price} ₽ · ${b.status==='active'?'Подтверждена':'Отменена'}`;$('bookings').append(div);}
}
$('show-password').onclick=()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('show-password').setAttribute('aria-pressed',String(show));$('show-password').textContent=show?'Скрыть пароль':'Показать пароль';};
$('auth-form').onsubmit=async e=>{e.preventDefault();const mode=e.submitter.value;const buttons=[...e.currentTarget.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{const data={email:$('email').value,password:$('password').value};if(mode==='register')data.name=$('name').value;const r=await api('/api/'+mode,'POST',data);token=r.token;user=r.user;$('password').value='';await cabinet();message(mode==='register'?'Аккаунт создан.':'Вход выполнен.');}catch(err){message(err.message);}finally{buttons.forEach(b=>b.disabled=false);}};
$('logout').onclick=async()=>{try{await api('/api/logout','POST',{});token='';user=null;await cabinet();message('Вы вышли.');}catch(e){message(e.message);}};
function clearSlots(){slotsVersion++;options($('time'),[],'Обновите свободное время');}
for(const name of ['service','master','day'])$(name).onchange=clearSlots;
$('load-slots').onclick=async()=>{const version=++slotsVersion;options($('time'),[],'Загрузка…');try{const q=new URLSearchParams({service_id:$('service').value,master_id:$('master').value,day:$('day').value});const r=await api('/api/slots?'+q);if(version!==slotsVersion)return;options($('time'),r.slots.map(n=>[n,time(n)]),r.slots.length?'Выберите время':'Свободного времени нет');message(r.slots.length?'Свободное время обновлено.':'Нет свободных слотов. Выберите другую дату.');}catch(e){if(version===slotsVersion){options($('time'),[],'Выберите корректные параметры');message(e.message);}}};
$('booking-form').onsubmit=async e=>{e.preventDefault();if(!user){message('Сначала войдите или создайте аккаунт.');$('email').focus();return;}const button=e.submitter;button.disabled=true;
 try{const b=await api('/api/bookings','POST',{service_id:Number($('service').value),master_id:Number($('master').value),day:$('day').value,start_min:Number($('time').value)});clearSlots();await cabinet();message(`Вы записаны! №${b.id}\n${b.service_name}, ${b.master_name}\n${b.day}, ${time(b.start_min)}–${time(b.end_min)} · ${b.price} ₽`);}catch(e){clearSlots();message(e.message);}finally{button.disabled=false;}};
async function init(){try{const [services,masters]=await Promise.all([api('/api/services'),api('/api/masters')]);options($('service'),services.map(s=>[s.id,`${s.name} · ${s.duration} мин · ${s.price} ₽`]),'Выберите услугу');options($('master'),masters.map(m=>[m.id,m.name]),'Выберите мастера');for(const s of services){const div=document.createElement('div');div.className='item';div.textContent=`${s.name} · ${s.duration} мин · ${s.price} ₽`;$('services').append(div);}}catch(e){message('Не удалось загрузить данные: '+e.message);}}
init();
