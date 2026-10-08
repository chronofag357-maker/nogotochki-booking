import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const digest = s=>createHash('sha256').update(s).digest('hex');
export function hashPassword(password){
 const salt=randomBytes(16).toString('hex');
 return salt+':'+scryptSync(password,salt,64).toString('hex');
}
export function verifyPassword(password,stored){
 const [salt,hash]=stored.split(':');
 const actual=scryptSync(password,salt,64), expected=Buffer.from(hash,'hex');
 return expected.length===actual.length && timingSafeEqual(actual,expected);
}
export function newSession(db,userId){
 const token=randomBytes(32).toString('hex');
 db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),userId,Date.now()+8*3600000);
 return token;
}
export function userForToken(db,token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)) return null;
 return db.prepare('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?').get(digest(token),Date.now());
}
