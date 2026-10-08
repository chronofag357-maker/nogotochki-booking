import {api} from './api.js';
export async function renderAdminTools(root,services,message){
 const [masters,schedule]=await Promise.all([api('/api/admin/masters'),api('/api/admin/schedules')]);
 root.replaceChildren();
 const field=(form,key,title,type,value='')=>{const l=document.createElement('label');l.textContent=title;const input=document.createElement('input');input.type=type;input.name=key;input.value=value;input.required=true;l.append(input);form.append(l);return input;};
 const select=(form,key,title,items,value)=>{const l=document.createElement('label');l.textContent=title;const input=document.createElement('select');input.name=key;for(const [id,text] of items)input.add(new Option(text,id));if(value!==undefined)input.value=value;l.append(input);form.append(l);return input;};
 const form=(title,url,method,setup,convert)=>{const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=title;const f=document.createElement('form');f.className='item';setup(f);const submit=document.createElement('button');submit.textContent='Сохранить';f.append(submit);f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await api(url,method,convert(Object.fromEntries(new FormData(f))));message('Сохранено. Обновите панель или клиентский экран для просмотра.');}catch(err){message(err.message);}finally{submit.disabled=false;}};details.append(summary,f);root.append(details);};
 form('Добавить услугу','/api/admin/services','POST',f=>{field(f,'name','Название новой услуги','text');field(f,'price','Цена, ₽','number');field(f,'duration','Длительность, мин','number');},d=>({...d,price:Number(d.price),duration:Number(d.duration)}));
 const serviceIds=services.map(s=>`${s.id} — ${s.name}`).join('; ');
 for(const m of [{id:0,name:'',active:1,services:[]},...masters])form(m.id?`Мастер №${m.id}: ${m.name}`:'Добавить мастера','/api/admin/masters'+(m.id?'/'+m.id:''),m.id?'PATCH':'POST',f=>{field(f,'name','Имя мастера','text',m.name);select(f,'active','Состояние',[[1,'Принимает записи'],[0,'Отключён']],m.active);field(f,'services','Номера услуг через запятую','text',m.services.join(','));const help=document.createElement('p');help.textContent=serviceIds;f.append(help);},d=>({...d,active:Number(d.active),services:d.services.split(',').map(n=>Number(n.trim()))}));
 const choose=f=>select(f,'master_id','Мастер',masters.map(m=>[m.id,m.name]));
 const interval=f=>{field(f,'start','Начало','time','10:00');field(f,'end','Конец','time','18:00');};
 const minutes=s=>{const[h,m]=s.split(':').map(Number);return h*60+m;};
 const convert=d=>({master_id:Number(d.master_id),start_min:minutes(d.start),end_min:minutes(d.end)});
 form('Настроить еженедельную смену','/api/admin/schedules','POST',f=>{choose(f);select(f,'weekday','День недели',[[0,'Воскресенье'],[1,'Понедельник'],[2,'Вторник'],[3,'Среда'],[4,'Четверг'],[5,'Пятница'],[6,'Суббота']]);interval(f);},d=>({...convert(d),weekday:Number(d.weekday)}));
 form('Заблокировать время на дату','/api/admin/blocks','POST',f=>{choose(f);field(f,'day','Дата блокировки','date');interval(f);field(f,'reason','Причина блокировки','text');},d=>({...convert(d),day:d.day,reason:d.reason}));
 const h=document.createElement('h3');h.textContent='Сохранённое расписание и блокировки';root.append(h);
 const days=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
 for(const r of [...schedule.weekly,...schedule.blocks]){const p=document.createElement('p');p.textContent=`${masters.find(m=>m.id===r.master_id)?.name||r.master_id} · ${r.day||days[r.weekday]} · ${clock(r.start_min)}–${clock(r.end_min)}${r.reason?' · Блок: '+r.reason:''}`;root.append(p);}
}
