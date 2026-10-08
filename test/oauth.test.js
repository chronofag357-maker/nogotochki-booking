import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDb} from '../server/db.js';
import {yandexAuth} from '../server/yandex.js';
test('Yandex PKCE: binding, single use, repeat login and no token persistence',async()=>{
 const db=openDb(':memory:');let requests=0;
 const oauth=yandexAuth(db,{clientId:'fixture-client',redirectUri:'https://example.test/auth/yandex/callback',request:async(url,options)=>{requests++;if(url.endsWith('/token')){assert.ok(options.body.get('code_verifier'));assert.equal(options.body.get('client_secret'),null);return {ok:true,json:async()=>({access_token:'fixture-only-token'})};}assert.equal(options.headers.Authorization,'OAuth fixture-only-token');return {ok:true,json:async()=>({client_id:'fixture-client',id:'fixture-id',default_email:'fixture@example.test',display_name:'Тестовый Яндекс'})};}});
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(){}});
 const start=async()=>{const r=response();await oauth.handle({method:'GET',headers:{}},r,new URL('https://example.test/auth/yandex'));assert.match(r.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/);return {state:new URL(r.headers.Location).searchParams.get('state'),cookie:r.headers['Set-Cookie'].split(';')[0]};};
 try{
  const first=await start();const wrong=response();await oauth.handle({method:'GET',headers:{}},wrong,new URL('https://example.test/auth/yandex/callback?state='+first.state+'&code=fixture'));assert.equal(wrong.headers.Location,'/?oauth=expired');assert.equal(requests,0);
  const flow=await start();const complete=response();const callback=new URL('https://example.test/auth/yandex/callback?state='+flow.state+'&code=fixture');await oauth.handle({method:'GET',headers:{cookie:flow.cookie}},complete,callback);assert.equal(complete.headers.Location,'/?oauth=success');assert.equal(requests,2);assert.ok(complete.headers['Set-Cookie'].some(s=>s.startsWith('nogotochki_session=')));
  const u=db.prepare('SELECT * FROM users').get();assert.equal(u.role,'client');assert.equal(u.password_hash,'');assert.equal(u.provider,'yandex');
  const replay=response();await oauth.handle({method:'GET',headers:{cookie:flow.cookie}},replay,callback);assert.equal(replay.headers.Location,'/?oauth=expired');assert.equal(requests,2);
  const again=await start();await oauth.handle({method:'GET',headers:{cookie:again.cookie}},response(),new URL('https://example.test/auth/yandex/callback?state='+again.state+'&code=fixture2'));assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,1);
 }finally{db.close();}
});
