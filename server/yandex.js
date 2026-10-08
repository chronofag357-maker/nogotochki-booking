import {randomBytes,createHash} from 'node:crypto';
import {ApiError} from './booking.js';
import {newSession} from './auth.js';
export function yandexAuth(db,{clientId=process.env.YANDEX_CLIENT_ID,redirectUri=process.env.YANDEX_REDIRECT_URI,request=fetch}={}){
 const pending=new Map();
 const enabled=!!(clientId&&redirectUri);
 const oauthCookie=(v,age)=>`nogotochki_oauth=${v}; Path=/auth/yandex; HttpOnly; SameSite=Lax; Max-Age=${age}; Secure`;
 return {enabled,async handle(req,res,url,currentUser){
  if(!['/auth/yandex','/auth/yandex/callback'].includes(url.pathname))return false;
  const redirect=where=>{res.writeHead(302,{Location:where,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return true;};
  if(!enabled)throw new ApiError(503,'Вход через Яндекс пока не настроен');
  if(req.method!=='GET')throw new ApiError(405,'Метод не разрешён');
  for(const [k,v]of pending)if(v.expires<Date.now())pending.delete(k);
  if(url.pathname==='/auth/yandex'){
   if(pending.size>=500)throw new ApiError(429,'Попробуйте вход позже');
   const state=randomBytes(32).toString('hex'),binding=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
   pending.set(state,{binding,verifier,expires:Date.now()+600000,userId:currentUser?.id});
   res.setHeader('Set-Cookie',oauthCookie(binding,600));
   const q=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,scope:'login:email login:info',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
   return redirect('https://oauth.yandex.ru/authorize?'+q);
  }
  const state=url.searchParams.get('state'),flow=pending.get(state);
  const binding=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('nogotochki_oauth='))?.slice(17);
  pending.delete(state);res.setHeader('Set-Cookie',oauthCookie('',0));
  if(!flow||flow.binding!==binding||flow.expires<Date.now())return redirect('/?oauth=expired');
  if(url.searchParams.has('error')||!url.searchParams.get('code'))return redirect('/?oauth=cancelled');
  try{
   const tokenResponse=await request('https://oauth.yandex.ru/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:url.searchParams.get('code'),client_id:clientId,code_verifier:flow.verifier}),signal:AbortSignal.timeout(10000)});
   if(!tokenResponse.ok)throw Error('token_exchange');const token=await tokenResponse.json();if(!token.access_token)throw Error('missing_token');
   const infoResponse=await request('https://login.yandex.ru/info?format=json',{headers:{Authorization:'OAuth '+token.access_token},signal:AbortSignal.timeout(10000)});
   if(!infoResponse.ok)throw Error('profile');const profile=await infoResponse.json();
   if(profile.client_id!==clientId||typeof profile.id!=='string'||typeof profile.default_email!=='string'||!/^\S+@\S+\.\S+$/.test(profile.default_email))throw Error('profile_invalid');
   const email=profile.default_email.trim().toLowerCase();
   db.exec('BEGIN IMMEDIATE');let account;
   try{
    account=db.prepare("SELECT * FROM users WHERE provider='yandex' AND provider_id=?").get(profile.id);
    if(!account){
     account=db.prepare('SELECT * FROM users WHERE email=?').get(email);
     // Never silently attach an external identity to a password account.
     // Start OAuth while signed into that account to prove both identities.
     if(account&&(account.id!==flow.userId||account.provider_id))throw Error('link_required');
     if(account)db.prepare("UPDATE users SET provider='yandex',provider_id=? WHERE id=?").run(profile.id,account.id);
     else{const created=db.prepare("INSERT INTO users(email,name,password_hash,provider,provider_id) VALUES(?,?,'','yandex',?)").run(email,String(profile.display_name||profile.real_name||'Клиент Яндекса').slice(0,80),profile.id);account={id:Number(created.lastInsertRowid)};}
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   const session=newSession(db,account.id);
   res.setHeader('Set-Cookie',[oauthCookie('',0),`nogotochki_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure`]);
   return redirect('/?oauth=success');
  }catch(e){return redirect('/?oauth='+(e.message==='link_required'?'link-required':'failed'));}
 }};
}
