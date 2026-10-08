import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
export function openDb(path=process.env.DB_PATH||'./data/nogotochki.sqlite') {
 if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
 db.exec('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY)');
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=1').get()) {
  db.exec('BEGIN IMMEDIATE');
  try {db.exec(readFileSync(new URL('./migrations/001_init.sql',import.meta.url),'utf8')); db.exec('INSERT INTO migrations VALUES(1); COMMIT');}
  catch(e){db.exec('ROLLBACK');db.close();throw e;}
 }
 return db;
}
