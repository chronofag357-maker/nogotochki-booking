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
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=2').get()) {
  db.exec('BEGIN IMMEDIATE');
  try {db.exec(readFileSync(new URL('./migrations/002_admin.sql',import.meta.url),'utf8'));db.exec('INSERT INTO migrations VALUES(2); COMMIT');}
  catch(e){db.exec('ROLLBACK');db.close();throw e;}
 }
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=3').get()) {
  db.exec('BEGIN IMMEDIATE');
  try{db.exec('CREATE TABLE date_blocks(id INTEGER PRIMARY KEY,master_id INTEGER NOT NULL REFERENCES masters(id),day TEXT NOT NULL,start_min INTEGER NOT NULL,end_min INTEGER NOT NULL,reason TEXT NOT NULL,CHECK(start_min>=0 AND end_min<=1440 AND start_min<end_min)); INSERT INTO migrations VALUES(3); COMMIT');}
  catch(e){db.exec('ROLLBACK');db.close();throw e;}
 }
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=4').get()){
  db.exec('BEGIN IMMEDIATE');
  try{db.exec('ALTER TABLE users ADD COLUMN provider TEXT; ALTER TABLE users ADD COLUMN provider_id TEXT; CREATE UNIQUE INDEX users_provider ON users(provider,provider_id) WHERE provider_id IS NOT NULL; INSERT INTO migrations VALUES(4); COMMIT');}
  catch(e){db.exec('ROLLBACK');db.close();throw e;}
 }
 return db;
}
